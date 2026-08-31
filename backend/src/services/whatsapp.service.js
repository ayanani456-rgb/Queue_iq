// -----------------------------------------------------------------------------
// WhatsApp sending — Vonage Messages API (sandbox)
// -----------------------------------------------------------------------------
// TODO(setup): Vonage sandbox is NOT connected yet. Set VONAGE_API_KEY /
// VONAGE_API_SECRET / VONAGE_WHATSAPP_FROM on the backend to turn on real
// sending. Until then every send is a console-log stub (nothing actually leaves
// the server) — the rest of the app works normally.
//
// Real send when the Vonage credentials are configured, otherwise a console-log
// stub so the app (and demos) still run before any credentials exist.
//
// Env vars for real sending (add on the backend service):
//   VONAGE_API_KEY       — Vonage API key
//   VONAGE_API_SECRET    — Vonage API secret
//   VONAGE_WHATSAPP_FROM — the sandbox WhatsApp number (digits, e.g. 14157386102)
//   VONAGE_MESSAGES_URL  — optional, defaults to the sandbox endpoint
//
// Note (sandbox): Vonage only delivers to numbers you've allow-listed in the
// Messages API sandbox, and the sandbox is capped (~100 msgs/month, 1/sec).
// -----------------------------------------------------------------------------

const MESSAGES_URL = process.env.VONAGE_MESSAGES_URL || 'https://messages-sandbox.nexmo.com/v1/messages';
const API_KEY = process.env.VONAGE_API_KEY;
const API_SECRET = process.env.VONAGE_API_SECRET;
const FROM = process.env.VONAGE_WHATSAPP_FROM;

// Vonage wants digits only, full international form (no '+').
function toDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

async function sendWhatsApp(phone, message) {
  const to = toDigits(phone);

  // No credentials yet -> log and succeed, so booking/dev flows don't break.
  if (!API_KEY || !API_SECRET || !FROM) {
    console.log(`[whatsapp:stub] -> ${to}: ${message}`);
    return { ok: true, stub: true };
  }

  try {
    const auth = Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');
    const res = await fetch(MESSAGES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: toDigits(FROM),
        to,
        channel: 'whatsapp',
        message_type: 'text',
        text: message,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`[whatsapp] send failed ${res.status}: ${JSON.stringify(data)}`);
      return { ok: false, status: res.status, error: data };
    }
    return { ok: true, data };
  } catch (e) {
    console.error(`[whatsapp] send error: ${e.message || e}`);
    return { ok: false, error: String(e.message || e) };
  }
}

module.exports = { sendWhatsApp };
