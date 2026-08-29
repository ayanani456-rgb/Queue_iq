// -----------------------------------------------------------------------------
// In-memory data store (Task 1 — "mock first" approach)
// -----------------------------------------------------------------------------
// There is no database connected yet, so we keep the queue in a plain JS array
// that lives in the server's memory. This is the SAME idea you used in the
// FastAPI service with plain variables.
//
// IMPORTANT to understand: because this lives in memory, the data resets every
// time the server restarts. That is fine for building + demoing. Later, when
// Supabase is connected, ONLY this file needs to change — the routes and
// controller stay exactly the same.
// -----------------------------------------------------------------------------

// Each token/row:
//   token     -> the PERMANENT id shown to the patient (e.g. "A-16"). Never changes.
//   phone     -> patient WhatsApp number
//   doctor    -> which doctor they are booked with
//   time      -> booked slot time
//   tokenType -> "normal" | "express" | "emergency"
//   position  -> where they stand in line right now (1 = front). This DOES change
//                as people are served and as express/emergency cut in.
//   status    -> "Waiting" | "Serving" | "Done" | "Skipped"
let queue = [
  { token: 'A-14', phone: '0300-1234567', doctor: 'Dr. Ayesha Khan', time: '10:15', tokenType: 'normal', position: 1, status: 'Done' },
  { token: 'A-15', phone: '0301-2345678', doctor: 'Dr. Ayesha Khan', time: '10:30', tokenType: 'normal', position: 2, status: 'Serving' },
  { token: 'A-16', phone: '0302-3456789', doctor: 'Dr. Rabia Hassan', time: '10:45', tokenType: 'normal', position: 3, status: 'Waiting' },
  { token: 'A-17', phone: '0303-4567890', doctor: 'Dr. Ayesha Khan', time: '11:00', tokenType: 'normal', position: 4, status: 'Waiting' },
];

// New bookings get a unique, ever-increasing token number: T-101, T-102, ...
// Using a running counter (instead of the position) makes the point obvious:
// the token number is a permanent ID, the position is separate and can move.
let tokenSeq = 100;

// Business config — stands in for the business's row in the DB. Different
// business TYPES serve at different paces, so the wait estimate depends on it.
// (Later this whole object comes from Supabase, keyed by the business id.)
const SERVICE_MINUTES_BY_TYPE = { clinic: 8, bank: 5, salon: 20, lab: 10, government: 6 };
const business = { clinicId: 'alshifa', type: 'clinic' };

// Return the business, with its average service time resolved from its type.
function getBusiness() {
  return { ...business, avgServiceMinutes: SERVICE_MINUTES_BY_TYPE[business.type] || 7 };
}

// --- Abuse tracking (PRD §8.3) ------------------------------------------------
// Count CONFIRMED false emergency claims per phone. A human REJECTION increments
// it; once it hits the limit, that number is suspended from Emergency tokens.
// (In-memory, so it resets on restart — later this lives in the DB.)
const FALSE_CLAIM_LIMIT = 2;
const falseClaims = {}; // phone -> count of confirmed false claims

function recordFalseClaim(phone) {
  falseClaims[phone] = (falseClaims[phone] || 0) + 1;
  return falseClaims[phone];
}

function isEmergencySuspended(phone) {
  return (falseClaims[phone] || 0) >= FALSE_CLAIM_LIMIT;
}

// Return ONE doctor's line (doctorId falsy -> the generic, no-doctor line).
function getQueue(doctorId) {
  return doctorId
    ? queue.filter((row) => row.doctorId === doctorId)
    : queue.filter((row) => !row.doctorId);
}

// Find one row by its token label, across all doctors.
function findToken(token) {
  return queue.find((row) => row.token === token);
}

// All tokens a given client booked.
function getTokensByClient(clientId) {
  return queue.filter((row) => row.clientId === clientId);
}

// Merge a doctor's line back in (upsert by token; other lines untouched).
function setQueue(next) {
  const map = new Map(queue.map((r) => [r.token, r]));
  for (const r of next) map.set(r.token, r);
  queue = [...map.values()];
}

// Hand out the next unique token number.
function nextTokenNumber() {
  tokenSeq += 1;
  return `T-${tokenSeq}`;
}

// Find the latest still-active token booked from a given phone number. Used by
// the WhatsApp webhook, which only knows the sender's number. Phones are matched
// loosely (last 10 digits) so "0300-1234567" matches "923001234567".
const ACTIVE_FOR_CONFIRM = ['Waiting', 'Serving', 'PendingApproval'];
function samePhone(a, b) {
  const na = String(a || '').replace(/\D/g, '');
  const nb = String(b || '').replace(/\D/g, '');
  if (!na || !nb) return false;
  return na.slice(-10) === nb.slice(-10);
}
function findTokenByPhone(phone) {
  const matches = queue.filter(
    (r) => samePhone(r.phone, phone) && ACTIVE_FOR_CONFIRM.includes(r.status),
  );
  return matches.length ? matches[matches.length - 1] : null;
}

module.exports = {
  getQueue, findToken, getTokensByClient, findTokenByPhone, setQueue, nextTokenNumber, getBusiness,
  FALSE_CLAIM_LIMIT, recordFalseClaim, isEmergencySuspended,
};
