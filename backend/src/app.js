// -----------------------------------------------------------------------------
// QueueIQ Node backend — entry point
// -----------------------------------------------------------------------------
require('dotenv').config();   // load .env (SUPABASE_URL, SUPABASE_KEY, QUEUEIQ_ORG_ID, …)
const express = require('express');
const app = express();

// Lets the server understand JSON request bodies (needed for POST requests).
app.use(express.json());

// --- Simple CORS ---------------------------------------------------------------
// The frontend runs on a different port (Next.js on 3000) than this API (5000).
// Browsers block cross-port requests unless the server allows them. This tiny
// middleware allows it. (Later you can replace this with the `cors` package.)
// TODO (before production): '*' lets ANY website read our responses in a
// browser. Fine for local dev, but replace it with our real frontend origin
// (e.g. 'https://queueiq.com') so only our own site is allowed. Note: '*' also
// cannot be used together with logged-in cookies, so this MUST become a specific
// origin once real auth is added.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// --- Routes --------------------------------------------------------------------
const businessRoutes = require('./routes/business.routes');
app.use('/api/business', businessRoutes);

const bookingRoutes = require('./routes/booking.routes');
app.use('/api/tokens', bookingRoutes);

// Health check — open http://localhost:5000/ to confirm the server is alive.
app.get('/', (req, res) => res.send('QueueIQ backend running'));

// Test console — open http://localhost:5000/test in your browser.
const path = require('path');
app.get('/test', (req, res) => res.sendFile(path.join(__dirname, 'public', 'test.html')));

// --- Start server --------------------------------------------------------------
const { startAi } = require('./startAi');
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`QueueIQ backend listening on http://localhost:${PORT}`);
  startAi();   // bring the AI microservice up alongside the server
});

module.exports = app;
