import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

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

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [systemPrompt, ...(Array.isArray(messages) ? messages : [])],
        temperature: 0.8,
        max_tokens: 400,
        top_p: 0.9
      })
    });

    const data = await groqRes.json();
    if (!groqRes.ok) throw new Error(JSON.stringify(data));

    const reply = data.choices?.[0]?.message?.content || "Jee bolen, kya help chahiye?";

    return NextResponse.json({ message: reply, reply: reply });

  } catch (e: any) {
    console.error("Chat API Error:", e);
    return NextResponse.json({ message: "Thora network issue hai, dobara bhej dein? 🙏", reply: "Thora network issue hai, dobara bhej dein? 🙏" }, { status: 200 });
  }
}
