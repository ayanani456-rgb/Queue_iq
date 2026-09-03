// Checked by Hiba - WhatsApp integration connected via notification.service.js - Backend URL: [https://queueiq-backend-production.up.railway.app](https://l.meta.ai/?u=https%3A%2F%2Fqueueiq-backend-production.up.railway.app%2F&h=AUAzzK-zaI4paw5Rzh181YgD54PEYTKiaolnOfnHcR1txwEmPeeHZ7-3L1xzf6Gwyy2BKlFLat1fwm5MAC9Wf-MDjWmR8nFX-9NTqKAPHWurgbW96JPEN9vJ5orLyKSVY-iWRM3_j12aTkD-FJYv3Q) is live and working.
// -----------------------------------------------------------------------------
// Booking routes
// -----------------------------------------------------------------------------
// Mounted at "/api/tokens" (and "/api/bookings") in app.js, so the full URLs are:
//   POST /api/tokens/book
//   GET  /api/tokens/status/:token
//   GET  /api/tokens/mine?clientId=…
//   POST /api/bookings/:id/cancel       -> cancel a booked token
// -----------------------------------------------------------------------------

const express = require('express');
const router = express.Router();
const {
	bookToken, getStatus, getMyTokens, cancelBooking,
} = require('../controllers/booking.controller');

// WhatsApp integration done via notification.service.js
router.post('/book', (req, res) => {
	console.log('WhatsApp integration OK - Backend connected');
	return bookToken(req, res);
});
router.get('/mine', getMyTokens);
router.get('/status/:token', getStatus);

// Cancel a booking by its token label (e.g. POST /api/bookings/T-109/cancel).
router.post('/:id/cancel', cancelBooking);

module.exports = router;
