// -----------------------------------------------------------------------------
// WhatsApp controllers (Layer 1 — basic confirm flow)
// -----------------------------------------------------------------------------
//   GET  /api/whatsapp/webhook  -> Meta's one-time verification handshake.
//   POST /api/whatsapp/webhook  -> incoming replies. "YES" confirms the booking.
//   POST /api/whatsapp/send     -> send a WhatsApp (pending appointment + voucher).
//
// Layer 2 (the Gemini bot) will slot into the "else" branch of receiveWebhook,
// where free-text messages are handled. For now that branch just nudges the user.
// -----------------------------------------------------------------------------

const { sendWhatsApp } = require('../services/whatsapp.service');
const { findTokenByPhone } = require('../data/store');

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'queueiq-verify';

// Words we treat as "confirm".
const YES_WORDS = new Set(['yes', 'y', 'haan', 'han', 'ha', 'ji', 'ok', 'okay', 'confirm']);

// GET /api/whatsapp/webhook — Meta calls this once with a challenge to verify
// you own the URL. Echo the challenge back when the verify token matches.
function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
}

// POST /api/whatsapp/send — outgoing "your booking is pending" message.
async function sendMessage(req, res) {
  const body = req.body || {};
  const dest = body.phone || body.to;
  if (!dest) return res.status(400).json({ error: 'phone is required' });

  const text = body.message
    || `QueueIQ: your appointment is pending.${body.token ? ` Token ${body.token}.` : ''}`
      + `${body.voucher ? ` Voucher ${body.voucher}.` : ''} Reply YES to confirm.`;

  const result = await sendWhatsApp(dest, text);
  return res.status(result.ok ? 200 : 502).json(result);
}

// Pull the sender + text out of Meta's webhook payload shape.
function extractIncoming(payload) {
  try {
    const value = payload && payload.entry && payload.entry[0]
      && payload.entry[0].changes && payload.entry[0].changes[0]
      && payload.entry[0].changes[0].value;
    const msg = value && value.messages && value.messages[0];
    if (!msg) return null;
    return { from: msg.from, text: (msg.text && msg.text.body ? msg.text.body : '').trim() };
  } catch (e) {
    return null;
  }
}

// POST /api/whatsapp/webhook — incoming messages.
async function receiveWebhook(req, res) {
  // Acknowledge Meta immediately (it retries on non-200); do the work after.
  res.sendStatus(200);

  const incoming = extractIncoming(req.body);
  if (!incoming || !incoming.from) return;
  const { from, text } = incoming;

  try {
    if (YES_WORDS.has(text.toLowerCase())) {
      const tok = await findTokenByPhone(from);
      if (tok) {
        await sendWhatsApp(
          from,
          `Booking confirmed. Your token is ${tok.token}`
            + `${tok.position ? `, position ${tok.position}` : ''}. See you soon.`,
        );
      } else {
        await sendWhatsApp(from, "We couldn't find a pending booking for this number. Please book again.");
      }
    } else {
      // Layer 2 (Gemini bot) will handle free text here.
      await sendWhatsApp(from, 'Thanks! Reply YES to confirm your booking. (AI assistant coming soon.)');
    }
  } catch (e) {
    console.error(`[whatsapp] webhook handling error: ${e.message || e}`);
  }
}

module.exports = { verifyWebhook, sendMessage, receiveWebhook };
