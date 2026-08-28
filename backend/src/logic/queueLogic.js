// -----------------------------------------------------------------------------
// Shared queue logic
// -----------------------------------------------------------------------------
// These helpers are used by BOTH the booking controller (placing tokens) and the
// business controller (approving emergencies). Keeping them in one module means
// there's a single definition of the rules — no copy that can drift out of sync.
// -----------------------------------------------------------------------------

// A token is "in the live line" only if it still needs serving.
const ACTIVE = ['Waiting', 'Serving'];
const isActive = (row) => ACTIVE.includes(row.status);

// Express priority (PRD §4, tuned): an express lets this many active tokens stay
// ahead, then jumps the rest of the normals. Set to 2 (was 3) so express gets a
// visible benefit in short lines too, while still protecting the front two so
// normals at the head of the queue are never swept away. Tunable via the
// EXPRESS_KEEP_AHEAD env var.
const EXPRESS_KEEP_AHEAD = Number(process.env.EXPRESS_KEEP_AHEAD ?? 2);

// Re-number positions by array order. PendingApproval / Rejected rows are NOT in
// the visible line, so they get position null (they don't occupy a queue slot).
function renumber(queue) {
  let pos = 0;
  queue.forEach((row) => {
    if (row.status === 'PendingApproval' || row.status === 'Rejected') {
      row.position = null;
    } else {
      pos += 1;
      row.position = pos;
    }
  });
}

// Decide WHERE a token slots into the queue array.
function findInsertIndex(queue, tokenType) {
  // Normal -> back of the line.
  if (tokenType === 'normal') return queue.length;

  // Emergency -> ahead of everyone Waiting, but not ahead of who's being Served.
  if (tokenType === 'emergency') {
    const idx = queue.findIndex((r) => r.status === 'Waiting');
    return idx === -1 ? queue.length : idx;
  }

  // Express -> keep the first EXPRESS_KEEP_AHEAD active tokens ahead, then cut in,
  // but never jump another express/emergency already in line.
  let ahead = 0;
  for (let i = 0; i < queue.length; i++) {
    const r = queue[i];
    if (!isActive(r)) continue;
    if (ahead < EXPRESS_KEEP_AHEAD) { ahead++; continue; }
    if (r.tokenType !== 'normal') continue;
    return i;
  }
  return queue.length;
}

// Count active tokens sitting before a given array index.
function peopleAheadOfIndex(queue, idx) {
  return queue.slice(0, idx).filter(isActive).length;
}

// Of those ahead, how many are emergencies (they add uncertainty to the ETA).
function emergencyAheadOfIndex(queue, idx) {
  return queue.slice(0, idx).filter((r) => isActive(r) && r.tokenType === 'emergency').length;
}

module.exports = {
  ACTIVE, isActive, EXPRESS_KEEP_AHEAD,
  renumber, findInsertIndex, peopleAheadOfIndex, emergencyAheadOfIndex,
};
