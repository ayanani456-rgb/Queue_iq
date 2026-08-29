// -----------------------------------------------------------------------------
// WhatsApp routes — mounted at "/api/whatsapp" in app.js, so the full URLs are:
//   GET  /api/whatsapp/webhook   (Meta verification handshake)
//   POST /api/whatsapp/webhook   (incoming replies — YES confirms)
//   POST /api/whatsapp/send      (send pending appointment + voucher)
// -----------------------------------------------------------------------------

const express = require('express');

const router = express.Router();
const { verifyWebhook, sendMessage, receiveWebhook } = require('../controllers/whatsapp.controller');

router.get('/webhook', verifyWebhook);
router.post('/webhook', receiveWebhook);
router.post('/send', sendMessage);

module.exports = router;
