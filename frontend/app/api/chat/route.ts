import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Read full messages array from body.messages or body directly
    const rawMessages = Array.isArray(body.messages)
      ? body.messages
      : Array.isArray(body)
      ? body
      : body.message
      ? [{ role: 'user', content: body.message }]
      : [];

    console.log("Chat backend received messages array:", rawMessages);

    const formattedMessages = rawMessages
      .map((item: any) => ({
        role:
          item.role === 'assistant' || item.sender === 'bot'
            ? 'assistant'
            : item.role === 'system'
            ? 'system'
            : 'user',
        content: String(item.content || item.text || ''),
      }))
      .filter((m: any) => Boolean(m.content));

    if (formattedMessages.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    const systemPrompt = {
      role: 'system',
      content:
        'You are QueueIQ AI Assistant for Al Shifa Clinic and healthcare queue management. ' +
        'Speak in a friendly Roman Urdu + English mix. ' +
        'Remember the Al Shifa clinic context (doctors, queue tokens Q-XXX, N-XXX, S-XXX, cardiology, dermatology, general). ' +
        'Do NOT repeat greetings if conversation is already underway. ' +
        'Answer user questions directly and maintain full continuous memory of previous messages in the conversation.',
    };

    const groqPayload = {
      model: 'llama-3.3-70b-versatile',
      messages: [systemPrompt, ...formattedMessages],
      temperature: 0.7,
      max_tokens: 600,
    };

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      const lastUserMsg = formattedMessages.filter((m: any) => m.role === 'user').pop()?.content || '';
      return NextResponse.json({
        reply: /salam|kaise|doctor|token|appointment/i.test(lastUserMsg)
          ? "Walaikum Assalam! Main QueueIQ Al Shifa assistant hoon. Main aapki appointment aur live token status mein madad kar sakta hoon."
          : "Hello! I am your QueueIQ Al Shifa Assistant. How can I help you with your appointment or queue token today?",
      });
    }

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(groqPayload),
    });

    if (!groqRes.ok) {
      // Fallback to llama-3.1-8b-instant if 70b is busy
      const fallbackRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...groqPayload,
          model: 'llama-3.1-8b-instant',
        }),
      });

      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        return NextResponse.json({
          reply: fallbackData.choices?.[0]?.message?.content || "Salam! Main aapki Al Shifa clinic mein kaise madad karun?",
        });
      }
    }

    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content || "Salam! Main aapki Al Shifa clinic mein kaise madad karun?";

    return NextResponse.json({ reply });
  } catch (e: any) {
    console.error("Chat error:", e);
    return NextResponse.json({ reply: "Network issue, phir se try karein!" }, { status: 200 });
  }
}
