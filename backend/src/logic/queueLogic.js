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

// The 3:1 rule (PRD §4): an express lets this many active tokens stay ahead,
// then jumps the rest of the normals.
const EXPRESS_KEEP_AHEAD = 3;

// Re-number positions by array order. PendingApproval / Rejected / Cancelled rows
// are NOT in the visible line, so they get position null (no queue slot).
const OUT_OF_LINE = ['PendingApproval', 'Rejected', 'Cancelled'];
function renumber(queue) {
  let pos = 0;
  queue.forEach((row) => {
    if (OUT_OF_LINE.includes(row.status)) {
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
