// -----------------------------------------------------------------------------
// Booking routes
// -----------------------------------------------------------------------------
// Mounted at "/api/tokens" in app.js, so the full URLs are:
//   POST /api/tokens/book
//   GET  /api/tokens/status/:token
//   GET  /api/tokens/mine?clientId=…
// -----------------------------------------------------------------------------

const express = require('express');
const router = express.Router();
const { bookToken, getStatus, getMyTokens } = require('../controllers/booking.controller');

// WhatsApp integration done via notification.service.js
router.post('/book', bookToken);
router.get('/mine', getMyTokens);
router.get('/status/:token', getStatus);

module.exports = router;
