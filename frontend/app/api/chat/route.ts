import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { message, history = [] } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "No message" }, { status: 400 });
    }

    const formattedHistory = Array.isArray(history)
      ? history
          .slice(-6)
          .map((item: any) => ({
            role: item.role === 'assistant' || item.sender === 'bot' ? 'assistant' : 'user',
            content: String(item.content || item.text || ''),
          }))
          .filter((m: any) => Boolean(m.content))
      : [];

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content:
              'You are QueueIQ AI. You are friendly, speak in Roman Urdu + English mix. You are like ChatGPT but for QueueIQ clinic queue system. Explain Q-, N-, S- tokens. If user says Salam, reply Walaikum Assalam. Be helpful, not repetitive. Never repeat same greeting.',
          },
          ...formattedHistory,
          { role: 'user', content: message },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content || "Salam! QueueIQ me kaise madad karun?";

    return NextResponse.json({ reply });
  } catch (e) {
    console.error("Chat error:", e);
    return NextResponse.json({ reply: "Network issue, phir se try karein!" });
  }
}
