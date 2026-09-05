const https = require("https");

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = process.env.GROQ_API_KEY;

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

function buildSystemPrompt(language = "en") {
  const hospitalsInfo = HOSPITALS_DATA.map(
    (h) =>
      `${h.name} (${h.location}) - Phone: ${h.phone}\n` +
      h.doctors.map((d) => `  • ${d.name} (${d.speciality}) - Rs. ${d.fee}, ${d.available}`).join("\n")
  ).join("\n\n");

  const urduPrompt = `آپ QueueIQ کا ایک ذہین اور مددگار ڈاکٹر کے دفتر میں کام کنے والے ایک ایجنٹ ہیں۔

آپ کے قابلیت:
1. مریضوں کو ٹوکن بکنگ میں مدد دینا
2. انتظار کے وقت کے بارے میں بتانا
3. ڈاکٹروں کی معلومات فراہم کرنا
4. اردو میں مکمل مدد دینا

دستیاب ہسپتالیں:
${hospitalsInfo}

ہمیشہ:
- خوش اخلاق اور مددگار رہیں
- مریض کا وقت قیمتی ہے یہ یاد رکھیں
- ہر سوال کا مکمل جواب دیں
- اردو میں لکھیں اور رومن اردو میں بھی ٹھیک ہے`;

  const englishPrompt = `You are QueueIQ's intelligent and helpful healthcare assistant working at a doctor's office.

Your capabilities:
1. Help patients book tokens/appointments
2. Provide wait time estimates
3. Give doctor information and specialties
4. Handle queries about fees and availability
5. Be multilingual (English and Urdu)

Available Hospitals:
${hospitalsInfo}

Always:
- Be friendly and empathetic
- Remember patient time is valuable
- Provide complete answers
- Follow up with relevant suggestions
- Use Urdu when user requests it`;

  return language === "ur" ? urduPrompt : englishPrompt;
}

async function callGroqAPI(messages, language = "en") {
  return new Promise((resolve, reject) => {
    const systemPrompt = buildSystemPrompt(language);
    const payload = JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const options = {
      hostname: "api.groq.com",
      path: "/openai/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        if (res.statusCode === 429) {
          // Rate limited, try with smaller model
          callGroqAPISmall(messages, language)
            .then(resolve)
            .catch(reject);
        } else if (res.statusCode !== 200) {
          reject(
            new Error(`Groq API error: ${res.statusCode} - ${data}`)
          );
        } else {
          const response = JSON.parse(data);
          resolve(response.choices[0].message.content);
        }
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

async function callGroqAPISmall(messages, language = "en") {
  return new Promise((resolve, reject) => {
    const systemPrompt = buildSystemPrompt(language);
    const payload = JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 400,
    });

    const options = {
      hostname: "api.groq.com",
      path: "/openai/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(
            new Error(`Groq API error: ${res.statusCode} - ${data}`)
          );
        } else {
          const response = JSON.parse(data);
          resolve(response.choices[0].message.content);
        }
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

async function sendChatMessage(userMessage, chatHistory, language = "en") {
  if (!GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY not configured. Set the environment variable."
    );
  }

  // Convert chat history to Groq format
  const messages = chatHistory.map((msg) => ({
    role: msg.role || "user",
    content: msg.content || msg.text,
  }));

  // Add current user message
  messages.push({
    role: "user",
    content: userMessage,
  });

  // Keep last 10 messages for context (but not too many to avoid token limits)
  const recentMessages = messages.slice(-10);

  try {
    const response = await callGroqAPI(recentMessages, language);
    return response;
  } catch (error) {
    console.error("Groq chat error:", error);
    throw error;
  }
}

module.exports = {
  sendChatMessage,
  HOSPITALS_DATA,
};
