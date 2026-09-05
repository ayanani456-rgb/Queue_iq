// -----------------------------------------------------------------------------
// Staff auth — issues the JWT that protects the /api/business/* endpoints.
// -----------------------------------------------------------------------------
//   POST /api/auth/login  { email, password } -> { token, user }
//
// Credentials are checked against Supabase's login() function (the same one the
// real frontend login uses) when Supabase is configured; otherwise a small demo
// staff list is used so offline/in-memory dev still works. The signed token is
// then sent by the frontend as `Authorization: Bearer <token>` on staff calls,
// where the auth middleware verifies it.
// -----------------------------------------------------------------------------
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');

const useSupabase = !!process.env.SUPABASE_KEY;

let supabase = null;
if (useSupabase) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
    auth: { persistSession: false },
  });
}

// Offline/in-memory demo staff (mirrors the frontend demo accounts). Only used
// when Supabase isn't configured — production always goes through the rpc above.
const DEMO_STAFF = {
  'admin@alshifa.com': { password: '123456', role: 'owner' },
  'reception@alshifa.com': { password: '123456', role: 'receptionist' },
  'dr.ayesha@alshifa.com': { password: '123456', role: 'doctor', doctorId: 'd1' },
};

// Return a normalized user object if the credentials are valid, else null.
async function verifyCredentials(email, password) {
  if (useSupabase) {
    // Same rpc the frontend/test harness use: params are p_email / p_password,
    // and it returns an array of matching account rows (empty when invalid).
    const { data, error } = await supabase.rpc('login', { p_email: email, p_password: password });
    if (error) throw error;
    const account = Array.isArray(data) ? data[0] : data;
    if (!account) return null;
    return {
      email: account.email || email,
      role: account.role || account.type || 'staff',
      doctorId: account.doctor_id || account.doctorId || null,
      orgId: account.organization_id || account.org_id || null,
    };
  }

  const demo = DEMO_STAFF[email];
  if (!demo || demo.password !== password) return null;
  return { email, role: demo.role, doctorId: demo.doctorId || null, orgId: null };
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  try {
    const user = await verifyCredentials(email, password);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '12h' });
    return res.json({ token, user });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}

module.exports = { login };
