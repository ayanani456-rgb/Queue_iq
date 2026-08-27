// -----------------------------------------------------------------------------
// Booking controllers — the WRITE + READ flow for tokens
// -----------------------------------------------------------------------------
//   POST /api/tokens/book          -> normal/express: insert + estimate.
//                                      emergency: verify (AI) + hold PendingApproval.
//   GET  /api/tokens/status/:token -> position -> people ahead -> AI estimate.
//
// Node does the COUNTING/PLACEMENT; FastAPI does the ESTIMATING and the emergency
// TRIAGE. The AI never decides — a human approves emergencies (PRD §8.3).
//
// The data store is selected in ../data/store (Supabase when configured, else
// in-memory). Its calls are async, so we await them.
// -----------------------------------------------------------------------------

const {
  getQueue, setQueue, findToken, getTokensByClient, nextTokenNumber, getBusiness, isEmergencySuspended,
} = require('../data/store');
const {
  isActive, renumber, findInsertIndex, peopleAheadOfIndex, emergencyAheadOfIndex,
} = require('../logic/queueLogic');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// Ask the AI service for a rich wait estimate; fall back to simple local math.
async function estimateWait({ clinicId, peopleAhead, emergencyAhead, avgServiceMinutes }) {
  try {
    const res = await fetch(AI_SERVICE_URL + '/api/ai/predict-wait', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicId, peopleAhead, emergencyAhead, avgServiceMinutes }),
    });
    if (!res.ok) throw new Error('AI service returned ' + res.status);
    const d = await res.json();
    return { ...d, estimateSource: 'ai' };
  } catch (e) {
    const eta = Math.max(0, Math.round(peopleAhead * avgServiceMinutes));
    return { peopleAhead, etaMinutes: eta, etaMin: eta, etaMax: eta, confidence: null, estimateSource: 'local-fallback' };
  }
}

// Ask the AI service to TRIAGE an emergency; if it's down, route to a human.
async function verifyEmergency({ type, description }) {
  try {
    const res = await fetch(AI_SERVICE_URL + '/api/ai/verify-emergency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, description }),
    });
    if (!res.ok) throw new Error('AI service returned ' + res.status);
    const d = await res.json();
    return { ...d, source: 'ai' };
  } catch (e) {
    return {
      urgencyScore: null, recommendation: 'needs_review', matchedSignals: [],
      reason: 'AI service unavailable — routed to human review.', decision: 'human_required',
      source: 'local-fallback',
    };
  }
}

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// POST /api/tokens/book
async function bookToken(req, res) {
  const body = req.body || {};

  // Sanitize input at the door — never trust what the client sends.
  // clientId: accept client_id or clientId; fall back to a placeholder patient
  // if it's missing or clearly not a real id (test value / too short to be a uuid).
  let clientId = body.client_id || body.clientId;
  if (!clientId || clientId === 'test-123' || clientId.length < 32) {
    clientId = '00000000-0000-0000-0000-000000000123';
  }

  // doctorId: only accept a well-formed uuid; anything else -> the generic
  // (no-doctor) line, so a malformed id can't blow up the database insert.
  let finalDoctorId = body.doctor_id || body.doctorId;
  const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalDoctorId || '');
  if (!isValidUuid) finalDoctorId = null;

  const { phone, doctor, tokenType = 'normal' } = body;

  if (!phone) return res.status(400).json({ error: 'phone is required' });
  if (!['normal', 'express', 'emergency'].includes(tokenType)) {
    return res.status(400).json({ error: 'tokenType must be normal, express, or emergency' });
  }
  if (tokenType === 'emergency') return bookEmergency(req, res);

  try {
    // per-doctor line: only this doctor's tokens
    const queue = await getQueue(finalDoctorId);
    const token = await nextTokenNumber();
    const idx = findInsertIndex(queue, tokenType);
    const row = {
      token, phone, doctor: doctor || 'Front Desk', doctorId: finalDoctorId, clientId, time: nowLabel(),
      tokenType, status: 'Waiting', position: 0,
    };
    queue.splice(idx, 0, row);
    renumber(queue);
    await setQueue(queue);

    const peopleAhead = peopleAheadOfIndex(queue, idx);
    const emergencyAhead = emergencyAheadOfIndex(queue, idx);
    const biz = await getBusiness();
    const est = await estimateWait({
      clinicId: biz.clinicId, peopleAhead, emergencyAhead, avgServiceMinutes: biz.avgServiceMinutes,
    });

    res.status(201).json({
      message: `Token ${token} booked`,
      token, tokenType, position: row.position,
      peopleAhead: est.peopleAhead, etaMinutes: est.etaMinutes,
      etaMin: est.etaMin, etaMax: est.etaMax,
      confidence: est.confidence, estimateSource: est.estimateSource,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

// Emergency path: abuse check -> AI triage -> hold PendingApproval (OUT of queue).
async function bookEmergency(req, res) {
  const { phone, doctor, doctorId, clientId, emergencyType, description } = req.body || {};
  try {
    if (await isEmergencySuspended(phone)) {
      return res.status(403).json({
        error: 'Emergency access is suspended for this number after repeated false claims. Please book a Normal or Express token.',
        suspended: true,
      });
    }

    const triage = await verifyEmergency({ type: emergencyType || '', description: description || '' });

    const token = await nextTokenNumber();
    const queue = await getQueue(doctorId);
    const row = {
      token, phone, doctor: doctor || 'Front Desk', doctorId: doctorId || null, clientId: clientId || null, time: nowLabel(),
      tokenType: 'emergency', status: 'PendingApproval', position: null,
      emergencyType: emergencyType || '', description: description || '', triage,
    };
    queue.push(row);
    renumber(queue);
    await setQueue(queue);

    res.status(201).json({
      message: 'Emergency submitted — awaiting staff approval',
      token, tokenType: 'emergency', status: 'PendingApproval', triage,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

// GET /api/tokens/status/:token
async function getStatus(req, res) {
  const { token } = req.params;
  try {
    const found = await findToken(token);
    if (!found) return res.status(404).json({ error: `Token ${token} not found` });

    // load only this token's doctor line, so position/wait are per-doctor
    const queue = await getQueue(found.doctorId);
    const row = queue.find((r) => r.token === token) || found;
    const idx = queue.findIndex((r) => r.token === token);
    const serving = queue.find((r) => r.status === 'Serving');

    if (!isActive(row)) {
      return res.json({
        token: row.token, tokenType: row.tokenType, position: row.position, status: row.status,
        peopleAhead: 0, etaMinutes: 0, etaMin: 0, etaMax: 0, confidence: null,
        estimateSource: 'n/a', nowServing: serving ? serving.token : null,
      });
    }

    const peopleAhead = peopleAheadOfIndex(queue, idx);
    const emergencyAhead = emergencyAheadOfIndex(queue, idx);
    const biz = await getBusiness();
    const est = await estimateWait({
      clinicId: biz.clinicId, peopleAhead, emergencyAhead, avgServiceMinutes: biz.avgServiceMinutes,
    });

    res.json({
      token: row.token, tokenType: row.tokenType, position: row.position, status: row.status,
      peopleAhead: est.peopleAhead, etaMinutes: est.etaMinutes,
      etaMin: est.etaMin, etaMax: est.etaMax,
      confidence: est.confidence, estimateSource: est.estimateSource,
      nowServing: serving ? serving.token : null,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

// GET /api/tokens/mine?clientId=…  -> every token this client booked, each with
// its own live status (position/wait within that token's doctor line).
async function getMyTokens(req, res) {
  const clientId = req.query.clientId;
  if (!clientId) return res.status(400).json({ error: 'clientId is required' });
  try {
    const mine = await getTokensByClient(clientId);
    const biz = await getBusiness();
    const queueCache = {};
    const out = [];
    for (const t of mine) {
      const key = t.doctorId || '__none__';
      if (!queueCache[key]) queueCache[key] = await getQueue(t.doctorId);
      const queue = queueCache[key];
      const idx = queue.findIndex((r) => r.token === t.token);
      const serving = queue.find((r) => r.status === 'Serving');
      let peopleAhead = 0;
      let est = { etaMinutes: 0, etaMin: 0, etaMax: 0, confidence: null, estimateSource: 'n/a' };
      if (isActive(t) && idx >= 0) {
        peopleAhead = peopleAheadOfIndex(queue, idx);
        const emergencyAhead = emergencyAheadOfIndex(queue, idx);
        est = await estimateWait({ clinicId: biz.clinicId, peopleAhead, emergencyAhead, avgServiceMinutes: biz.avgServiceMinutes });
      }
      out.push({
        token: t.token, tokenType: t.tokenType, doctor: t.doctor, status: t.status,
        position: t.position, peopleAhead: est.peopleAhead != null ? est.peopleAhead : peopleAhead,
        etaMinutes: est.etaMinutes, etaMin: est.etaMin, etaMax: est.etaMax,
        confidence: est.confidence, estimateSource: est.estimateSource,
        nowServing: serving ? serving.token : null,
      });
    }
    res.json({ clientId, count: out.length, tokens: out });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

module.exports = { bookToken, getStatus, getMyTokens };
