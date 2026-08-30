// -----------------------------------------------------------------------------
// WhatsApp controllers (Vonage) — Layer 1 (confirm flow) + Layer 2 (Gemini bot)
// -----------------------------------------------------------------------------
//   GET  /api/whatsapp/webhook  -> health / (Meta) verify handshake if present.
//   POST /api/whatsapp/webhook  -> incoming messages. "YES" confirms the booking;
//                                  anything else goes to the Gemini bot (Layer 2).
//   POST /api/whatsapp/status   -> Vonage delivery receipts (ignored, just 200s).
//   POST /api/whatsapp/send     -> send a WhatsApp (pending appointment + voucher).
// -----------------------------------------------------------------------------

const { sendWhatsApp } = require('../services/whatsapp.service');
const { findTokenByPhone } = require('../data/store');
const { botReply } = require('../services/gemini.service');

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'queueiq-verify';

// Words we treat as "confirm".
const YES_WORDS = new Set(['yes', 'y', 'haan', 'han', 'ha', 'ji', 'ok', 'okay', 'confirm']);

// GET /api/whatsapp/webhook — Vonage doesn't need a handshake, so this is mostly
// a health check. If a Meta-style challenge shows up, we answer that too (handy
// if the provider is ever switched back to Meta Cloud API).
function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe') {
    if (token === VERIFY_TOKEN) return res.status(200).send(challenge);
    return res.sendStatus(403);
  }
  return res.sendStatus(200);
}

// POST /api/whatsapp/status — Vonage message-status callbacks. We don't act on
// delivery receipts yet; just acknowledge so Vonage stops retrying.
function statusWebhook(req, res) {
  return res.sendStatus(200);
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

// Pull the sender + text out of the incoming webhook payload. Handles Vonage's
// Messages API shape (flat from/text), with a Meta-shape fallback.
function extractIncoming(payload) {
  try {
    if (!payload) return null;

    // Vonage Messages API v1: { from, channel, message_type, text, ... }
    if (payload.from && (payload.text || payload.message_type || payload.channel)) {
      const from = typeof payload.from === 'object'
        ? (payload.from.number || payload.from.id || '')
        : payload.from;
      const text = payload.text
        || (payload.message && payload.message.content && payload.message.content.text)
        || '';
      if (from) return { from: String(from), text: String(text).trim() };
    }

    // Meta Cloud API fallback: entry[].changes[].value.messages[]
    const value = payload.entry && payload.entry[0]
      && payload.entry[0].changes && payload.entry[0].changes[0]
      && payload.entry[0].changes[0].value;
    const msg = value && value.messages && value.messages[0];
    if (msg) return { from: msg.from, text: (msg.text && msg.text.body ? msg.text.body : '').trim() };

    return null;
  } catch (e) {
    return null;
  }
}

// POST /api/whatsapp/webhook — incoming messages.
async function receiveWebhook(req, res) {
  // Acknowledge immediately (providers retry on non-200); do the work after.
  res.sendStatus(200);

  const incoming = extractIncoming(req.body);
  if (!incoming || !incoming.from) return;
  const { from, text } = incoming;

  try {
    // Layer 1: "YES" confirms a pending booking.
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
      return;
    }

    // Layer 2: free text -> Gemini bot (uses live data via tools).
    const reply = await botReply(text, from);
    if (reply) {
      await sendWhatsApp(from, reply);
    } else {
      // Gemini not configured yet -> simple Layer 1 fallback.
      await sendWhatsApp(from, 'Thanks! Reply YES to confirm your booking, or ask me about doctors and wait times.');
    }
  } catch (e) {
    console.error(`[whatsapp] webhook handling error: ${e.message || e}`);
  }
}

module.exports = { verifyWebhook, statusWebhook, sendMessage, receiveWebhook };
