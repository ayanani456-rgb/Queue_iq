// -----------------------------------------------------------------------------
// WhatsApp bot tools — the 3 functions the Gemini bot can call.
// -----------------------------------------------------------------------------
// These wrap the EXISTING backend logic (store + queueLogic) so the bot always
// works off LIVE data, never dummy values. No HTTP layer — called directly by
// gemini.service during the tool-calling loop.
// -----------------------------------------------------------------------------

const store = require('../data/store');
const {
  isActive, renumber, findInsertIndex, peopleAheadOfIndex,
} = require('../logic/queueLogic');

const DEFAULT_CLIENT_ID = '00000000-0000-0000-0000-000000000123';

// Resolve a doctor by (loose) name match against the org's doctor list.
async function resolveDoctor(name, hospital) {
  const doctors = await store.getDoctors(hospital);
  if (!name) return null;
  const needle = String(name).toLowerCase();
  return (
    doctors.find((d) => (d.name || '').toLowerCase().includes(needle))
    || doctors.find((d) => needle.includes((d.name || '').toLowerCase()))
    || null
  );
}

// Tool 1 — which doctors are available.
async function getDoctors({ hospital } = {}) {
  const doctors = await store.getDoctors(hospital);
  return {
    hospital: hospital || 'this clinic',
    doctors: doctors.map((d) => ({
      name: d.name, specialty: d.specialty, fee: d.fee, experience: d.experience,
    })),
  };
}

// Tool 2 — live queue status for a doctor.
async function getQueueStatus({ doctor, hospital } = {}) {
  const doc = await resolveDoctor(doctor, hospital);
  if (!doc) return { error: `No doctor found matching "${doctor}".` };
  const queue = await store.getQueue(doc.id);
  const serving = queue.find((r) => r.status === 'Serving');
  const waiting = queue.filter((r) => r.status === 'Waiting');
  const biz = await store.getBusiness();
  const estWaitMin = waiting.length * (biz.avgServiceMinutes || 8);
  return {
    doctor: doc.name,
    nowServing: serving ? serving.token : null,
    peopleWaiting: waiting.length,
    estWaitMinForNewArrival: estWaitMin,
  };
}

// Tool 3 — book a new normal token for a doctor + phone.
async function generateToken({ doctor, phone, hospital } = {}) {
  if (!phone) return { error: 'phone is required to book.' };
  const doc = await resolveDoctor(doctor, hospital);
  if (!doc) return { error: `No doctor found matching "${doctor}".` };

  const queue = await store.getQueue(doc.id);
  const token = await store.nextTokenNumber();
  const idx = findInsertIndex(queue, 'normal');
  const row = {
    token, phone, doctor: doc.name, doctorId: doc.id, clientId: DEFAULT_CLIENT_ID,
    tokenType: 'normal', status: 'Waiting', position: 0,
  };
  queue.splice(idx, 0, row);
  renumber(queue);
  await store.setQueue(queue);

  const peopleAhead = peopleAheadOfIndex(queue, idx);
  const biz = await store.getBusiness();
  const estWaitMin = peopleAhead * (biz.avgServiceMinutes || 8);
  return {
    token: row.token,
    doctor: doc.name,
    position: row.position,
    peopleAhead,
    estWaitMin,
    voucher: row.token, // voucher id = token id for now
  };
}

module.exports = { getDoctors, getQueueStatus, generateToken };
