// -----------------------------------------------------------------------------
// queueStore — SUPABASE version (per-doctor queues)
// -----------------------------------------------------------------------------
// Each doctor has their OWN line. getQueue(doctorId) returns just that doctor's
// tokens, so positions and waits are computed per doctor — a client for Doctor A
// never waits behind Doctor B. Generic (non-doctor) bookings use doctorId = null.
// -----------------------------------------------------------------------------
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
  auth: { persistSession: false },
});

const ORG_ID = process.env.QUEUEIQ_ORG_ID;
const FALSE_CLAIM_LIMIT = 2;
const SERVICE_MINUTES_BY_TYPE = { clinic: 8, bank: 5, salon: 20, lab: 10, government: 6 };

function fromDb(r) {
  return {
    token: r.token_number,
    phone: r.phone || undefined,
    doctor: r.doctor || undefined,
    doctorId: r.doctor_id || undefined,
    clientId: r.client_id || undefined,
    time: r.slot_time || undefined,
    tokenType: r.token_type,
    position: r.queue_position,
    status: r.status,
    emergencyType: r.emergency_type || undefined,
    description: r.description || undefined,
    triage: r.triage || undefined,
  };
}

function toDb(row) {
  return {
    organization_id: ORG_ID,
    doctor_id: row.doctorId || null,
    client_id: row.clientId || null,
    doctor: row.doctor || null,
    token_number: row.token,
    phone: row.phone || null,
    slot_time: row.time || null,
    token_type: row.tokenType,
    queue_position: row.position == null ? null : row.position,
    status: row.status,
    emergency_type: row.emergencyType || null,
    description: row.description || null,
    triage: row.triage || null,
  };
}

// One doctor's line (doctorId = null -> the generic, no-doctor line).
async function getQueue(doctorId) {
  let q = supabase.from('tokens').select('*').eq('organization_id', ORG_ID);
  q = doctorId ? q.eq('doctor_id', doctorId) : q.is('doctor_id', null);
  const { data, error } = await q
    .order('queue_position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(fromDb);
}

// Save a doctor's line back (upsert every row by token number).
async function setQueue(queue) {
  if (!queue || !queue.length) return;
  const rows = queue.map(toDb);
  const { error } = await supabase
    .from('tokens')
    .upsert(rows, { onConflict: 'organization_id,token_number' });
  if (error) throw error;
}

// Find one token across ALL doctors (used by status/complete/approve, which
// start from just a token number and then load that token's doctor line).
async function findToken(token) {
  const { data, error } = await supabase
    .from('tokens').select('*')
    .eq('organization_id', ORG_ID).eq('token_number', token)
    .maybeSingle();
  if (error) throw error;
  return data ? fromDb(data) : null;
}

// All tokens a given client booked (newest first), across all doctors.
async function getTokensByClient(clientId) {
  const { data, error } = await supabase
    .from('tokens').select('*')
    .eq('organization_id', ORG_ID).eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromDb);
}

async function nextTokenNumber() {
  const { data, error } = await supabase.rpc('next_token_number');
  if (error) throw error;
  return data;
}

async function getBusiness() {
  const { data, error } = await supabase
    .from('organizations').select('id, type, avg_service_minutes')
    .eq('id', ORG_ID).single();
  if (error) throw error;
  return {
    clinicId: data.id, type: data.type,
    avgServiceMinutes: data.avg_service_minutes || SERVICE_MINUTES_BY_TYPE[data.type] || 7,
  };
}

async function recordFalseClaim(phone) {
  const { data, error } = await supabase.rpc('record_false_claim', { p_phone: phone, p_limit: FALSE_CLAIM_LIMIT });
  if (error) throw error;
  return data;
}

async function isEmergencySuspended(phone) {
  const { data, error } = await supabase
    .from('patients').select('emergency_suspended').eq('phone', phone).maybeSingle();
  if (error) throw error;
  return !!(data && data.emergency_suspended);
}

// Find the latest still-active token booked from a given phone number. Used by
// the WhatsApp webhook, which only knows the sender's number. Phones are matched
// loosely (last 10 digits) so "0300-1234567" matches "923001234567".
async function findTokenByPhone(phone) {
  const last10 = String(phone || '').replace(/\D/g, '').slice(-10);
  if (!last10) return null;
  const { data, error } = await supabase
    .from('tokens').select('*')
    .eq('organization_id', ORG_ID)
    .in('status', ['Waiting', 'Serving', 'PendingApproval'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  const row = (data || []).find(
    (r) => String(r.phone || '').replace(/\D/g, '').slice(-10) === last10,
  );
  return row ? fromDb(row) : null;
}

module.exports = {
  getQueue, setQueue, findToken, getTokensByClient, findTokenByPhone, nextTokenNumber, getBusiness,
  recordFalseClaim, isEmergencySuspended, FALSE_CLAIM_LIMIT,
};
