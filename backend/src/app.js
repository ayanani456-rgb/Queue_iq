// -----------------------------------------------------------------------------
// QueueIQ Node backend — entry point
// -----------------------------------------------------------------------------
require('dotenv').config();   // load .env (SUPABASE_URL, SUPABASE_KEY, QUEUEIQ_ORG_ID, …)
const express = require('express');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const app = express();

// --- CORS ----------------------------------------------------------------------
// The frontend runs on a different origin than this API, so the browser needs the
// server's permission to make cross-origin calls. We use the standard `cors`
// package instead of hand-written headers. Allowing the `Authorization` header
// lets the frontend send a login token later — note CORS only permits the header
// through the door; it does NOT authenticate anyone (that's a separate concern).
// TODO (before production): '*' lets ANY website read our responses in a browser.
// Fine for local dev, but replace it with our real frontend origin
// (e.g. 'https://queueiq.com'). '*' also cannot be combined with logged-in cookies.
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('/{*splat}', cors());   // answer the browser's preflight (pre-check) request

// Lets the server understand JSON request bodies (needed for POST requests).
app.use(express.json());

// --- Routes --------------------------------------------------------------------
const businessRoutes = require('./routes/business.routes');
app.use('/api/business', businessRoutes);

const bookingRoutes = require('./routes/booking.routes');
app.use('/api/tokens', bookingRoutes);
const bookingRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/bookings', bookingRateLimiter, bookingRoutes);

// Health check — open http://localhost:5000/ to confirm the server is alive.
app.get('/', (req, res) => res.send('QueueIQ backend running'));

// Test console — open http://localhost:5000/test in your browser.
const path = require('path');
app.get('/test', (req, res) => res.sendFile(path.join(__dirname, 'public', 'test.html')));

// --- Start server --------------------------------------------------------------
const { startAi } = require('./startAi');
const { connectRedis } = require('./config/redis');
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`QueueIQ backend listening on http://localhost:${PORT}`);
  connectRedis().catch((error) => console.error('Redis connection failed', error));
  startAi();   // bring the AI microservice up alongside the server
});

module.exports = app;
