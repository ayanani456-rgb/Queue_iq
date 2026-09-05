// -----------------------------------------------------------------------------
// Business dashboard controllers — PER-DOCTOR queues
// -----------------------------------------------------------------------------
// Every queue is scoped to one doctor. A receptionist manages several doctors'
// lines by choosing which doctorId to view/edit; a doctor sees only their own.
//   GET  /api/business/tokens?doctorId=…   -> that doctor's line + summary
//   POST /api/business/call-next  { doctorId }
//   POST /api/business/complete   { token }
//   POST /api/business/approve-emergency { token, decision }
// -----------------------------------------------------------------------------

const { getQueue, setQueue, findToken, recordFalseClaim, isEmergencySuspended, FALSE_CLAIM_LIMIT } = require('../data/store');
const { renumber, findInsertIndex } = require('../logic/queueLogic');
const { sendWhatsApp } = require('../services/whatsapp.service.js');

function buildSummary(queue) {
  const nowServing = queue.find((row) => row.status === 'Serving');
  return {
    nowServing: nowServing ? nowServing.token : null,
    waiting: queue.filter((row) => row.status === 'Waiting').length,
    done: queue.filter((row) => row.status === 'Done').length,
    total: queue.length,
  };
}

// GET /api/business/tokens?doctorId=…
async function getTokens(req, res) {
  try {
    const doctorId = req.query.doctorId || null;
    const queue = await getQueue(doctorId);
    res.json({ doctorId, summary: buildSummary(queue), tokens: queue });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

// POST /api/business/call-next   body: { doctorId }
async function callNext(req, res) {
  try {
    const { doctorId } = req.body || {};
    const queue = await getQueue(doctorId);

    const current = queue.find((row) => row.status === 'Serving');
    if (current) current.status = 'Done';

    const next = queue.find((row) => row.status === 'Waiting');
    if (!next) {
      await setQueue(queue);
      return res.status(200).json({
        message: 'No one is waiting in this doctor\'s line.',
        nowServing: null, doctorId, summary: buildSummary(queue), tokens: queue,
      });
    }
    next.status = 'Serving';
    await setQueue(queue);

    // Notify the next few STILL-waiting patients (excludes the one just called,
    // who is now 'Serving'). `queue` is already in line order, so its remaining
    // 'Waiting' rows are the true upcoming order — no separate sort needed.
    const upcoming = queue.filter((row) => row.status === 'Waiting').slice(0, 3);
    for (const [index, booking] of upcoming.entries()) {
      try {
        await sendWhatsApp(
          booking.phone,
          `Get ready! Your turn is in ${index + 1} - Token ${booking.token}`,
        );
      } catch (error) {
        console.error('WhatsApp notification failed', error);
      }
    }

    res.json({
      message: `Now serving ${next.token}`,
      nowServing: next.token, doctorId, summary: buildSummary(queue), tokens: queue,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

// POST /api/business/complete   body: { token }
async function completeVisit(req, res) {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token is required in the request body' });
  try {
    const found = await findToken(token);
    if (!found) return res.status(404).json({ error: `Token ${token} not found` });

    const queue = await getQueue(found.doctorId);
    const row = queue.find((r) => r.token === token) || found;
    row.status = 'Done';
    await setQueue(queue);

    res.json({
      message: `${token} marked as completed`,
      ratingRequestQueued: true, doctorId: found.doctorId,
      summary: buildSummary(queue), tokens: queue,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

// POST /api/business/approve-emergency   body: { token, decision }
async function approveEmergency(req, res) {
  const { token, decision } = req.body || {};
  if (!token || !['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ error: 'token and decision ("approve" or "reject") are required' });
  }
  try {
    const found = await findToken(token);
    if (!found) return res.status(404).json({ error: `Token ${token} not found` });
    if (found.status !== 'PendingApproval') {
      return res.status(409).json({ error: `Token ${token} is not pending approval (status: ${found.status})` });
    }

    const queue = await getQueue(found.doctorId);
    const row = queue.find((r) => r.token === token) || found;

    if (decision === 'reject') {
      row.status = 'Rejected';
      const count = await recordFalseClaim(row.phone);
      renumber(queue);
      await setQueue(queue);
      const suspended = await isEmergencySuspended(row.phone);
      return res.json({
        message: `${token} rejected`,
        token, status: 'Rejected', falseClaims: count, suspended,
        note: suspended
          ? 'This number is now suspended from Emergency tokens.'
          : `Warning ${count}/${FALSE_CLAIM_LIMIT} confirmed false claims.`,
        summary: buildSummary(queue), tokens: queue,
      });
    }

    // approve: enter THIS doctor's line at the front of the waiting list.
    const curIdx = queue.findIndex((r) => r.token === token);
    if (curIdx === -1) queue.push(row);
    const [approved] = curIdx === -1 ? [row] : queue.splice(curIdx, 1);
    approved.status = 'Waiting';
    const insertIdx = findInsertIndex(queue, 'emergency');
    queue.splice(insertIdx, 0, approved);
    renumber(queue);
    await setQueue(queue);

    res.json({
      message: `${token} approved — entered the line at position ${approved.position}`,
      token, status: 'Waiting', position: approved.position,
      summary: buildSummary(queue), tokens: queue,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

module.exports = { getTokens, callNext, completeVisit, approveEmergency };
