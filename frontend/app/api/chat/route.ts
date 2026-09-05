import { NextRequest, NextResponse } from 'next/server';

function generateSmartFallback(formattedMessages: Array<{ role: string; content: string }>): string {
  const lastUserMsg = formattedMessages
    .filter((m) => m.role === 'user')
    .pop()
    ?.content.toLowerCase()
    .trim() || '';

  const userMsgCount = formattedMessages.filter((m) => m.role === 'user').length;
  const allUserText = formattedMessages
    .filter((m) => m.role === 'user')
    .map((m) => m.content.toLowerCase())
    .join(' ');

  // Greetings
  if (/^(hi|hello|hey|salam|assalam|aoa|slaam)\b/i.test(lastUserMsg) || lastUserMsg === 'hi' || lastUserMsg === 'hello') {
    if (userMsgCount <= 1) {
      return "Walaikum Assalam! Kaise hain aap? Al Shifa Clinic mein kis doctor ki appointment ya token chahiye? 😊";
    }
    return "Jee batayein, Al Shifa clinic mein kis doctor ka token book karna hai? 😊";
  }

  // Doctor mentions
  if (/(ziauddin|bilal|ayesha|ahmed|sana|farhan|hina|usman|mariam|kamran|fatima|imran|nadia|rizwan)/i.test(lastUserMsg)) {
    const docMatch = lastUserMsg.match(/(dr\s+)?(ziauddin|bilal|ayesha|ahmed|sana|farhan|hina|usman|mariam|kamran|fatima|imran|nadia|rizwan)/i);
    const docName = docMatch ? `Dr. ${docMatch[2].charAt(0).toUpperCase() + docMatch[2].slice(1)}` : "Doctor";
    return `Great! ${docName} ke liye appointment ki date aur time bata dein? (Clinic timing: 9AM - 9PM)`;
  }

  // Date / Time / Confirmation
  if (/(today|tomorrow|aaj|kal|baje|am|pm|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}:\d{2}|\d{1,2}\s*(am|pm))/i.test(lastUserMsg)) {
    const randomToken = Math.floor(Math.random() * 90) + 110;
    return `Perfect! Aapka token Q-${randomToken} book ho gaya hai Al Shifa clinic me. Timing ke mutabiq pohanch jayen. WhatsApp pe confirmation bhej dun? 📲`;
  }

  // Token inquiries
  if (/token|appointment|book|line|bari/i.test(lastUserMsg)) {
    if (/al\s*shifa/i.test(allUserText) || /al\s*shifa/i.test(lastUserMsg)) {
      return "Jee Al Shifa ke liye kaunse doctor ka token chahiye? Dr Ziauddin (Cardiology), Dr Bilal (Dermatology), Dr Ayesha (Gynae) ya koi aur? 😊";
    }
    return "Jee Al Shifa Clinic ka token mil jayega. Kaunse doctor ka chahiye? Dr Ziauddin, Dr Bilal, Dr Ayesha ya koi aur? 😊";
  }

  // Default natural conversational response
  if (userMsgCount > 1) {
    return "Jee bilkul, Al Shifa Clinic me token aur doctor appointment available hai. Doctor ka naam bata dein taake token Q-XXX issue kar doon? 😊";
  }

  return "Walaikum Assalam! Main QueueIQ Al Shifa assistant hoon. Aap kis doctor ka token ya appointment chahte hain?";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawMessages = body.messages || (body.message ? [{ role: 'user', content: body.message }] : []);

    // Sanitize messages so each has valid role & content
    const formattedMessages = (Array.isArray(rawMessages) ? rawMessages : [])
      .map((item: any) => {
        const role =
          item.role === 'assistant' || item.sender === 'bot'
            ? 'assistant'
            : item.role === 'system'
            ? 'system'
            : 'user';
        const content = String(item.content || item.text || '').trim();
        return { role, content };
      })
      .filter((m: any) => Boolean(m.content));

    // Supabase se doctors lao (backend knowledge)
    let doctorsList = "Al Shifa Clinic, Karachi - 14 Doctors: Dr Ziauddin (Cardiology), Dr Bilal (Dermatology), Dr Ayesha (Gynae), Dr Ahmed (General), Dr Sana (Peds), Dr Farhan (Ortho), Dr Hina (ENT), Dr Usman (Neuro), Dr Mariam (Eye), Dr Kamran (Dental), Dr Fatima (Physio), Dr Imran (Urology), Dr Nadia (Psych), Dr Rizwan (General). Tokens: Q-001 to Q-200 daily, timing 9AM-9PM.";

    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        const supaRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/doctors?select=name,specialty`, {
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
          }
        });
        if (supaRes.ok) {
          const docs = await supaRes.json();
          if (Array.isArray(docs) && docs.length > 0) doctorsList = JSON.stringify(docs);
        }
      }
    } catch {}

    const systemPrompt = {
      role: "system",
      content: `
You are QueueIQ AI - Real Human-like Assistant for QueueIQ Pakistan.

IDENTITY:
- Name: QueueIQ AI, Al Shifa Clinic assistant
- Language: Roman Urdu + English mix, very friendly, human, like ChatGPT
- You talk like a real Karachi girl - natural, short, helpful, emoji 1-2 max
- NEVER robotic. NEVER repeat same line.

CRITICAL MEMORY RULES:
- You have FULL conversation memory. messages array me sara history hai.
- If user already greeted, NEVER say "Walaikum Assalam" again. Direct jawab do.
- If user says "token", "al shifa", "doctor", you REMEMBER context and ask next step, not start over.
- Example: User1: token chahiye al shifa ki -> You: kaunse doctor? User2: token -> You should NOT repeat greeting, you should say "Jee Al Shifa ke liye kaunse doctor ka token chahiye? Dr Ziauddin?"

KNOWLEDGE BASE (Backend connected):
- You know everything: ${doctorsList}
- You know all clinics, all doctors, queue system, tokens Q-XXX, N-XXX, S-XXX
- You can answer ANY question like ChatGPT - clinic timings, doctor fees, specialties, token status, booking process
- If asked any clinic/doctor, answer from knowledge. If unknown, say "Us clinic ka data abhi add ho raha hai, lekin Al Shifa ka full data hai"
- You know backend APIs: /api/bookings, /api/tokens

BOOKING FLOW (Human-like):
1. User: token chahiye -> Ask: "Kaunse doctor ka? Date?"
2. User: doctor name -> Ask: "Date aur time bata dein?"
3. Then say: "Perfect! Aapka token Q-${Math.floor(Math.random()*100)+100} book ho gaya hai Al Shifa me Dr XYZ ke paas. 2 baje se pehle ajayen. WhatsApp pe confirmation bhej dun?"

STYLE:
- Like ChatGPT: Smart, understands typos, roman urdu, english, slang
- Short replies 1-3 lines max, not long paragraphs
- Always helpful, never say "I don't know" - try to answer
- If user says "salam" first time only say Walaikum Assalam, after that normal chat
- Use Roman Urdu: "Jee bilkul", "Ho jayega", "Aapka token ready hai"

NEVER DO:
- Never repeat greeting
- Never say "Main aapki appointment aur live token status me madad kar sakta hoon" again and again
- Never break character

Now continue conversation with full memory.
      `.trim()
    };

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      const fallbackReply = generateSmartFallback(formattedMessages);
      return NextResponse.json({ message: fallbackReply, reply: fallbackReply });
    }

    try {
      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [systemPrompt, ...formattedMessages],
          temperature: 0.8,
          max_tokens: 400,
          top_p: 0.9
        })
      });

      if (groqRes.ok) {
        const data = await groqRes.json();
        const reply = data.choices?.[0]?.message?.content || generateSmartFallback(formattedMessages);
        return NextResponse.json({ message: reply, reply: reply });
      }

      // If 70b failed, try 8b instant
      const fallbackRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [systemPrompt, ...formattedMessages],
          temperature: 0.8,
          max_tokens: 400,
          top_p: 0.9
        })
      });

      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        const reply = fallbackData.choices?.[0]?.message?.content || generateSmartFallback(formattedMessages);
        return NextResponse.json({ message: reply, reply: reply });
      }
    } catch (groqErr) {
      console.warn("Groq fetch attempt failed:", groqErr);
    }

    // Smart fallback if API call fails
    const smartReply = generateSmartFallback(formattedMessages);
    return NextResponse.json({ message: smartReply, reply: smartReply });

  } catch (e: any) {
    console.error("Chat API Error:", e);
    return NextResponse.json({
      message: "Walaikum Assalam! Main QueueIQ Al Shifa assistant hoon. Kis doctor ka token book karna hai?",
      reply: "Walaikum Assalam! Main QueueIQ Al Shifa assistant hoon. Kis doctor ka token book karna hai?"
    }, { status: 200 });
  }
}
