// -----------------------------------------------------------------------------
// WhatsApp routes — mounted at "/api/whatsapp" in app.js, so the full URLs are:
//   GET  /api/whatsapp/webhook   (health / verify handshake)
//   POST /api/whatsapp/webhook   (incoming messages — YES confirms, else bot)
//   POST /api/whatsapp/status    (Vonage delivery receipts — acknowledged)
//   POST /api/whatsapp/send      (send pending appointment + voucher)
// -----------------------------------------------------------------------------

const express = require('express');

const router = express.Router();
const {
  verifyWebhook, statusWebhook, sendMessage, receiveWebhook,
} = require('../controllers/whatsapp.controller');

router.get('/webhook', verifyWebhook);
router.post('/webhook', receiveWebhook);
router.post('/status', statusWebhook);
router.post('/send', sendMessage);

module.exports = router;
