import { NextRequest, NextResponse } from "next/server";

const HOSPITALS_DATA = [
  {
    name: "Ziauddin Hospital North Nazimabad",
    location: "North Nazimabad, Karachi",
    phone: "+92 21 3123 4567",
    doctors: [
      {
        name: "Dr. Ayesha Khan",
        speciality: "Dermatology",
        fee: 1500,
        available: "Mon-Fri 10AM-2PM",
      },
      {
        name: "Dr. Saleem Iqbal",
        speciality: "Cardiology",
        fee: 2000,
        available: "Mon-Fri 9AM-5PM",
      },
    ],
  },
  {
    name: "Mamji Hospital",
    location: "Gulshan-e-Iqbal, Karachi",
    phone: "+92 21 3456 7890",
    doctors: [
      {
        name: "Dr. Fatima Noor",
        speciality: "General Medicine",
        fee: 1000,
        available: "Mon-Sun 4PM-8PM",
      },
    ],
  },
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userMessage = body.message || "";
    const language = body.language || "en";
    const history = Array.isArray(body.history) ? body.history : [];

    if (!userMessage || !userMessage.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;

    const hospitalsInfo = HOSPITALS_DATA.map(
      (h) =>
        `${h.name} (${h.location}) - Phone: ${h.phone}\n` +
        h.doctors.map((d) => `  • ${d.name} (${d.speciality}) - Rs. ${d.fee}, ${d.available}`).join("\n")
    ).join("\n\n");

    const systemPrompt = `You are QueueIQ's intelligent healthcare and queue management AI assistant.
You help patients book tokens (Q-XXX for clinics, S-XXX for salons, N-XXX for NADRA, B-XXX for banks), check wait times, find doctors, and get queue updates.

Available Hospitals & Doctors:
${hospitalsInfo}

Guidelines:
- Language: You understand and communicate fluently in English, Urdu, and Roman Urdu. Respond in the user's preferred language or matching the query language.
- If user greets with Salam or Hello, reply with warmth (e.g. Walaikum Assalam).
- Provide quick, polite, and helpful assistance.
- Keep responses concise, clear, and easy to read.`;

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
      const msg = userMessage.trim().toLowerCase();
      let reply = "";

      if (/\b(al[-\s]?shifa|shifa)\b/i.test(msg)) {
        if (/\b(ayesha|gynae|gynecolog)/i.test(msg)) {
          reply = "Al-Shifa Clinic mein Dr. Ayesha Khan (Gynecologist) available hain. Live token Q-112! Timing: 02:00 PM - 03:00 AM.";
        } else if (/\b(cardio|heart|rabia|salman)\b/i.test(msg)) {
          reply = "Al-Shifa Clinic Cardiology department mein Dr. Rabia Hassan (Fee: Rs. 1800) aur Dr. Salman Iqbal available hain. Queue Q-112.";
        } else {
          reply = "Al-Shifa Clinic mein Cardiology (Dr. Rabia), Gynecology (Dr. Ayesha), Dermatology (Dr. Zoya), Dentistry (Dr. Hina) aur General Medicine ke doctors available hain.";
        }
      } else if (/\b(nadra|nic|cnic|b[-\s]?form|frc)\b/i.test(msg)) {
        reply = "NADRA Gulberg Centre mein New NIC, Renewal, aur B-Form ke liye token N-series issue hota hai. Timing: 8:00 AM - 4:00 PM. Fee: Rs. 1000.";
      } else if (/\b(salon|hair|facial|beard|spa)\b/i.test(msg)) {
        reply = "Style Salon Gulberg mein Haircut, Facial, aur Grooming ke liye S-tokens issue hote hain. Timing: 10:00 AM - 9:00 PM.";
      } else if (/^(hi|hello|hey|salam|assalam|aoa)\b/i.test(msg)) {
        reply = "Walaikum Assalam! Main QueueIQ AI Assistant hoon. Main aapki clinic token (Q-series), NADRA (N-series), aur salon booking (S-series) mein madad kar sakta hoon.";
      } else {
        reply = "Main QueueIQ Assistant hoon. Aap Al-Shifa Clinic, NADRA Gulberg, aur Style Salon ke tokens aur timings ke baare mein pooch sakte hain.";
      }

      return NextResponse.json({
        reply,
        language,
        hospitalsData: HOSPITALS_DATA,
        timestamp: new Date(),
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
      // Fallback model if 70b is busy
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
          language,
          hospitalsData: HOSPITALS_DATA,
          timestamp: new Date(),
        });
      }
    }

    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content || "Salam! QueueIQ me kaise madad karun?";

    return NextResponse.json({
      reply,
      language,
      hospitalsData: HOSPITALS_DATA,
      timestamp: new Date(),
    });
  } catch (error: any) {
    console.error("Chatbot API route error:", error);
    return NextResponse.json(
      {
        reply: "Salam! QueueIQ service is active. Aap apna sawal dobara pooch sakte hain.",
        error: error.message || "Failed to process chat message",
      },
      { status: 200 }
    );
  }
}
