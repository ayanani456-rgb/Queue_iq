import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userMessage = body.message || "";
    const language = body.language || "en";
    const history = Array.isArray(body.history) ? body.history : [];
    const hospitalsData = body.hospitalsData;

    if (!userMessage) {
      return NextResponse.json({ error: "No message" }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;

    let hospitalContext = "";
    if (Array.isArray(hospitalsData) && hospitalsData.length > 0) {
      hospitalContext = `\n\nAvailable Hospitals & Live Doctors:\n${JSON.stringify(hospitalsData, null, 2)}`;
    }

    const systemPrompt = `You are QueueIQ AI Assistant - a helpful, friendly AI like ChatGPT. You have full knowledge about QueueIQ AND general world knowledge.

QueueIQ context:
- QueueIQ is AI-powered real-time queue management for Pakistan - skip wait at clinics, salons, NADRA, banks, labs.
- How it works: User searches clinic/salon/NADRA/bank -> enters WhatsApp number -> chooses Pay Online or Pay at Reception -> gets token S-XXX for salon, N-XXX for NADRA, Q-XXX for clinic, B-XXX for bank, L-XXX for lab -> token shows in My Bookings.
- Features: Real-time queue, AI wait prediction, WhatsApp notifications, My Bookings page, Business dashboard.
- Built by Hiba Shaukat, student from Karachi.${hospitalContext}

Your personality:
- Friendly, smart, conversational, helpful.
- Can answer ANY question in user's language (Roman Urdu or English).
- If user greets with Salam, respond warmly with Walaikum Assalam.
- Proactively guide them on token booking (Q-XXX, N-XXX, S-XXX) when relevant.
- Use emojis lightly. Never repeat the exact same greeting repeatedly.`;

    const formattedHistory = history
      .slice(-8)
      .map((item: any) => ({
        role: item.role === "assistant" || item.sender === "bot" ? "assistant" : "user",
        content: String(item.content || item.text || ""),
      }))
      .filter((m: any) => Boolean(m.content));

    const messages = [
      { role: "system", content: systemPrompt },
      ...formattedHistory,
      { role: "user", content: userMessage },
    ];

    if (!apiKey) {
      return NextResponse.json({
        reply: language === "ur" || /[\u0600-\u06FF]|kya|kaise|hai|salam/i.test(userMessage)
          ? "Walaikum Assalam! Main QueueIQ AI hoon. Aapki doctor appointment ya token booking mein kaise madad karoon?"
          : "Hello! I am your QueueIQ AI Assistant. How can I help you with your appointment or token today?",
      });
    }

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!groqRes.ok) {
      // Fallback to llama-3.1-8b-instant if 70b is busy
      const fallbackRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages,
          temperature: 0.7,
          max_tokens: 600,
        }),
      });
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        return NextResponse.json({
          reply: fallbackData.choices?.[0]?.message?.content || "Salam! QueueIQ me kaise madad karun?",
        });
      }
    }

    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content || "Salam! QueueIQ me kaise madad karun?";
    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Groq API error:", error);
    return NextResponse.json({ reply: "Network issue, phir se try karein!" }, { status: 200 });
  }
}
