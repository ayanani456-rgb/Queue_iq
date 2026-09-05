// -----------------------------------------------------------------------------
// Business dashboard routes (Task 1)
// -----------------------------------------------------------------------------
// This file maps URLs to controller functions. It does no real work itself —
// it just says "when this URL is called, run this function".
// -----------------------------------------------------------------------------

const express = require('express');
const router = express.Router();
const { getTokens, callNext, completeVisit, approveEmergency } = require('../controllers/business.controller');
const auth = require('../middleware/auth');

// Every staff action requires a valid JWT (obtained from POST /api/auth/login and
// sent as `Authorization: Bearer <token>`). Applied to the whole router so no
// business route is ever left open.
router.use(auth);

// These paths are relative — in app.js this router is mounted at "/api/business",
// so the full URLs become /api/business/tokens, etc.
router.get('/tokens', getTokens);
router.post('/call-next', callNext);
router.post('/complete', completeVisit);
router.post('/approve-emergency', approveEmergency);

module.exports = router;
