// -----------------------------------------------------------------------------
// Gemini bot (Layer 2) — the conversational WhatsApp assistant.
// -----------------------------------------------------------------------------
// TODO(setup): the Gemini bot is NOT connected yet. Set GEMINI_API_KEY (from
// aistudio.google.com) on the backend to turn it on. Until then botReply()
// returns null and the webhook uses the simple Layer 1 fallback reply — safe to
// ship as-is. The 3 tools (bot.tools.js) already work on live data.
//
// Runs a tool-calling loop against Google's Gemini API: the user's message goes
// in with 3 tool declarations; when Gemini asks to call a tool, we run it on our
// LIVE data (bot.tools) and feed the result back; when Gemini returns text, we
// send that as the WhatsApp reply.
//
// Env vars:
//   GEMINI_API_KEY  — from aistudio.google.com (free tier)
//   GEMINI_MODEL    — optional, defaults to gemini-1.5-flash
//
// If GEMINI_API_KEY is not set, botReply() returns null and the webhook falls
// back to the simple Layer 1 hint — so this is safe to ship before the key exists.
// -----------------------------------------------------------------------------

const tools = require('./bot.tools');

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_STEPS = 5;

const SYSTEM_PROMPT = [
  "You are QueueIQ's WhatsApp assistant for a clinic in Pakistan.",
  'Reply in short, friendly roman-Urdu (Urdu written with English letters).',
  'Always use the tools to get LIVE data — never invent doctors, tokens, or wait times.',
  'If the user asks which doctors are available, call getDoctors.',
  'If they ask about the current token or wait time, call getQueueStatus.',
  'If they want to book, call generateToken (use their WhatsApp number as phone),',
  'then tell them their token number and the estimated wait.',
  'Keep replies to 1-3 short sentences.',
].join(' ');

const functionDeclarations = [
  {
    name: 'getDoctors',
    description: 'List the doctors available at a hospital/clinic.',
    parameters: {
      type: 'object',
      properties: { hospital: { type: 'string', description: 'Hospital or clinic name (optional)' } },
    },
  },
  {
    name: 'getQueueStatus',
    description: 'Live queue status for a doctor: which token is serving now and the estimated wait.',
    parameters: {
      type: 'object',
      properties: {
        doctor: { type: 'string', description: 'Doctor name' },
        hospital: { type: 'string', description: 'Hospital or clinic name (optional)' },
      },
      required: ['doctor'],
    },
  },
  {
    name: 'generateToken',
    description: 'Book a new normal token for a doctor for the given phone number.',
    parameters: {
      type: 'object',
      properties: {
        doctor: { type: 'string', description: 'Doctor name' },
        phone: { type: 'string', description: 'Patient WhatsApp phone number' },
        hospital: { type: 'string', description: 'Hospital or clinic name (optional)' },
      },
      required: ['doctor', 'phone'],
    },
  },
];

async function runTool(name, args) {
  const fn = tools[name];
  if (!fn) return { error: `unknown tool ${name}` };
  try {
    return await fn(args || {});
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

async function callGemini(contents, senderPhone) {
  const url = `${BASE}/${MODEL}:generateContent?key=${API_KEY}`;
  const body = {
    system_instruction: {
      parts: [{ text: `${SYSTEM_PROMPT}\n\nThe user's WhatsApp number is ${senderPhone}.` }],
    },
    contents,
    tools: [{ function_declarations: functionDeclarations }],
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`[gemini] ${res.status}: ${JSON.stringify(data)}`);
    throw new Error(`gemini ${res.status}`);
  }
  return data;
}

// Returns the reply text, or null if Gemini isn't configured (caller falls back).
async function botReply(userMessage, senderPhone) {
  if (!API_KEY) return null;

  const contents = [{ role: 'user', parts: [{ text: userMessage }] }];

  for (let step = 0; step < MAX_STEPS; step++) {
    const data = await callGemini(contents, senderPhone);
    const parts = (data.candidates && data.candidates[0]
      && data.candidates[0].content && data.candidates[0].content.parts) || [];

    const call = parts.map((p) => p.functionCall).find(Boolean);
    if (call) {
      // record the model's tool-call turn, run it, feed the result back
      contents.push({ role: 'model', parts: [{ functionCall: call }] });
      const result = await runTool(call.name, call.args);
      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: call.name, response: { result } } }],
      });
      continue;
    }

    const text = parts.map((p) => p.text).filter(Boolean).join(' ').trim();
    return text || 'Maaf kijiye, samajh nahi aaya. Dobara likhein?';
  }

  return 'Yeh thoda time le raha hai. Baraye meharbani dobara koshish karein.';
}

module.exports = { botReply };
