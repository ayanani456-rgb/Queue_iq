// -----------------------------------------------------------------------------
// WhatsApp sending — Meta (Facebook) WhatsApp Cloud API
// -----------------------------------------------------------------------------
// Real send when the Meta credentials are configured, otherwise a console-log
// stub so the app (and demos) still run before any credentials exist.
//
// Needs these env vars for real sending (add on the backend service):
//   WHATSAPP_TOKEN            — Meta access token (temp dev token or a permanent
//                              system-user token)
//   WHATSAPP_PHONE_NUMBER_ID  — the test/business number's Phone Number ID
//   WHATSAPP_GRAPH_VERSION    — optional, defaults to v21.0
//
// Note (free test phase): Meta only delivers to the (up to 5) recipient numbers
// you registered in the developer console. Any other number is silently dropped
// by Meta — that's a Meta limit, not a bug here.
// -----------------------------------------------------------------------------

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0';
const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// Meta wants the recipient as digits only, in full international form (no '+').
function toDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

async function sendWhatsApp(phone, message) {
  const to = toDigits(phone);

  // No credentials yet -> log and succeed, so booking/dev flows don't break.
  if (!TOKEN || !PHONE_NUMBER_ID) {
    console.log(`[whatsapp:stub] -> ${to}: ${message}`);
    return { ok: true, stub: true };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: message },
        }),
      },
    );
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
