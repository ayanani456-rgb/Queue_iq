import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || "";

    // FETCH ALL ORGANIZATIONS FROM SUPABASE - FULL DB ACCESS
    let allOrgsText = "";
    let allDoctorsText = "";
    try {
      const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supaUrl && supaKey) {
        // Fetch organizations
        const orgRes = await fetch(`${supaUrl}/rest/v1/organizations?select=id,name,type,category,address,description`, {
          headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` }
        });
        if (orgRes.ok) {
          const orgs = await orgRes.json();
          allOrgsText = `ALL ORGANIZATIONS IN QUEUEIQ DB (${orgs.length} total): ${JSON.stringify(orgs).slice(0, 3000)}`;

          // If filter bug - log types
          console.log("ORG TYPES:", orgs.map((o: any) => `${o.name}:${o.type}`));
        }

        // Fetch doctors
        const docRes = await fetch(`${supaUrl}/rest/v1/doctors?select=name,specialty,organization_id`, {
          headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` }
        });
        if (docRes.ok) {
          const docs = await docRes.json();
          allDoctorsText = `ALL DOCTORS: ${JSON.stringify(docs).slice(0, 2000)}`;
        }
      }
    } catch (e) { console.log("Supabase fetch failed, using fallback"); }

    // FALLBACK DATA IF SUPABASE FAILS
    if (!allOrgsText) {
      allOrgsText = `
      Organizations:
            1. Al Shifa Clinic (type:hospital, category:health) - Cardiology, Dermatology, Gynae doctors, token Q-XXX, 9AM-9PM
            2. Nadra Gulberg (type:government, category:nadra) - NIC, B-Form, Family Registration Certificate, token N-XXX, 8AM-4PM, docs: Original CNIC, B-Form, photo
            3. City Medical Center (type:hospital, category:health) - General physicians, lab tests
            4. Style Salon Gulberg (type:salon, category:beauty) - Haircut, Facial, token S-XXX, 10AM-9PM
            5. Other hospitals/clinics in DB
      `;
    }

    const systemPrompt = {
      role: "system",
      content: `
You are QueueIQ AI - SUPER SMART Assistant for ENTIRE QueueIQ Pakistan (NOT just Al Shifa!)

YOU KNOW EVERYTHING FROM DATABASE:
${allOrgsText}
${allDoctorsText}

YOUR JOB - LIKE CHATGPT:
- User kuch bhi poochega - Nadra, Salon, Hospital, NIC, token, doctor, beauty, government service - sab ka jawab hai tumhare paas!
- NEVER say "Al Shifa ka kaunsa doctor chahiye" unless user is talking about hospital/medical!
- Understand intent:
    * If user says "nadra ka batao, nic banwana hai" -> Talk about Nadra Gulberg, token N-XXX, docs needed: B-Form, photo, fees 1000rs, timing 8AM-4PM
    * If user says "salon" -> Talk about Style Salon, services, token S-XXX
    * If user says "hospital" / "doctor" -> Then talk about Al Shifa / City Medical
    * If user says "hi" -> Say "Walaikum Assalam! QueueIQ pe aapko kis cheez me help chahiye? Hospital, Nadra, ya Salon? 😊" - GENERIC, not just Al Shifa!

CRITICAL RULES:
1. Memory: Full messages array - never repeat greeting after first message
2. Intent Detection: Pehchano user kya chahta hai - nadra? hospital? salon?
3. Generic Welcome: First message: "Main aapki QueueIQ pe madad kar sakta hun - hospital token, Nadra NIC, salon booking - kya chahiye?"
4. Specific Help:
      - Nadra: N-XXX tokens, NIC renewal, B-Form, FRC - docs, fees, timing
      - Hospital: Q-XXX tokens, doctors list, 9AM-9PM
      - Salon: S-XXX tokens, services list, 10AM-9PM
5. ChatGPT Style: Roman Urdu + English mix, friendly, short 2-3 lines, 1 emoji max
6. If user asks random like "nic banwana hai" -> Don't say Al Shifa! Say Nadra!

EXAMPLES:
User: hi -> "Walaikum Assalam! QueueIQ pe kis cheez ka token chahiye? Hospital, Nadra, ya Salon? 😊"
User: nadra ka batao -> "Jee Nadra Gulberg me NIC ke liye token N-XXX milta hai. 8AM-4PM. B-Form aur photo le ayen. Fees 1000rs. Kya token book kar dun?"
User: ayesha -> If previous was Nadra, don't jump to Dr Ayesha! Ask clarification: "Ayesha kis department me? Nadra me ya Al Shifa me Dr Ayesha?"
User: mujhe nic banwana hai -> "Nadra Gulberg me NIC new/renewal ke liye N-token lagta hai. Aapka token N-45 hai, kal 10 baje ajayen. Documents:..."

You are NOT limited to Al Shifa. You are for ALL.
      `.trim()
    };

    // Try Groq first if key exists, fallback to conversational engine
    try {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) throw new Error("No GROQ_API_KEY");

      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            systemPrompt,
            ...messages.map((m: any) => ({
              role: m.role || (m.sender === 'user' ? 'user' : 'assistant'),
              content: m.content || m.text || ''
            }))
          ],
          temperature: 0.7,
          max_tokens: 450
        })
      });

      if (groqRes.ok) {
        const data = await groqRes.json();
        const reply = data.choices?.[0]?.message?.content;
        if (reply) return NextResponse.json({ message: reply, reply });
      }
      throw new Error("Groq API error");
    } catch {
      // SMART CONVERSATIONAL ENGINE WITH MULTI-TURN MEMORY
      const fullHistoryText = messages.map((m: any) => (m.content || m.text || '').toLowerCase()).join(" ");
      const msg = lastMsg.trim().toLowerCase();

      let reply = "";

      // Check specific queries FIRST (to prevent greetings or broad words from hijacking)
      if (/\b(al[-\s]?shifa|shifa)\b/i.test(msg)) {
        if (/\b(ayesha|gynae|gynecolog)/i.test(msg) || fullHistoryText.includes('ayesha')) {
          reply = "Al-Shifa Clinic mein Dr. Ayesha Khan (Gynecologist) active hain (Timing: 02:00 PM - 03:00 AM). Current live token Q-112 chal raha hai. Aap direct homepage se token book kar sakte hain!";
        } else if (/\b(cardio|heart|rabia|salman)\b/i.test(msg)) {
          reply = "Al-Shifa Clinic Cardiology department mein Dr. Rabia Hassan (Fee: Rs. 1800) aur Dr. Salman Iqbal available hain. Current queue Q-112 chal rahi hai.";
        } else if (/\b(derma|skin|zoya|omar)\b/i.test(msg)) {
          reply = "Al-Shifa Clinic Dermatology mein Dr. Zoya Ahmed (Fee: Rs. 1400) aur Dr. Omar Siddiqui available hain. Live token Q-114 chal raha hai.";
        } else if (/\b(dent|teeth|hina|bilal)\b/i.test(msg)) {
          reply = "Al-Shifa Dentistry department mein Dr. Hina Yousuf aur Dr. Bilal Tariq available hain (Fee: Rs. 1200).";
        } else {
          reply = "Al-Shifa Clinic mein Cardiology (Dr. Rabia), Gynecology (Dr. Ayesha), Dermatology (Dr. Zoya), Dentistry (Dr. Hina), aur General Medicine ke doctors available hain. Aapko kis doctor ya department ka token chahiye?";
        }
      } else if (/\b(city[-\s]?medical|city\s*med)\b/i.test(msg)) {
        reply = "City Medical Center mein General Physicians aur Diagnostic Lab tests available hain. Timing: 9:00 AM - 9:00 PM. Token Q-series mein issue hota hai.";
      } else if (/\b(dr\.?|doctor|doctors)\b/i.test(msg)) {
        if (/\b(ayesha)\b/i.test(msg)) {
          reply = "Dr. Ayesha Khan (Gynecologist) Al-Shifa Clinic mein available hain. Timing: 02:00 PM - 03:00 AM (Room 3, Fee: Rs. 500). Live Token Q-112!";
        } else if (/\b(rabia)\b/i.test(msg)) {
          reply = "Dr. Rabia Hassan (Cardiologist) Al-Shifa Clinic mein available hain. Fee: Rs. 1800. Serving Token Q-112, Waiting Token Q-113.";
        } else if (/\b(salman)\b/i.test(msg)) {
          reply = "Dr. Salman Iqbal (Cardiologist) Al-Shifa Clinic mein available hain. Serving Token Q-115.";
        } else if (/\b(zoya)\b/i.test(msg)) {
          reply = "Dr. Zoya Ahmed (Dermatologist) Al-Shifa Clinic mein available hain. Serving Token Q-114.";
        } else {
          reply = "Al-Shifa Clinic ke main specialist doctors:\n• Dr. Ayesha Khan (Gynecologist - Room 3)\n• Dr. Rabia Hassan (Cardiologist)\n• Dr. Salman Iqbal (Cardiologist)\n• Dr. Zoya Ahmed (Dermatologist)\n• Dr. Hina Yousuf (Dentist)\nKiske liye token book karna chahte hain?";
        }
      } else if (/\b(nadra|nic|cnic|b[-\s]?form|frc)\b/i.test(msg)) {
        const randToken = "N-" + (Math.floor(Math.random() * 80) + 120);
        reply = `NADRA Gulberg Centre mein New NIC, Renewal, aur B-Form ke liye token ${randToken} issue hota hai. Timing: 8:00 AM - 4:00 PM. Zaruri documents: Original CNIC / B-Form + Photographs. Fees: Rs. 1000.`;
      } else if (/\b(salon|hair|facial|beard|spa|style\s*salon)\b/i.test(msg)) {
        const randToken = "S-" + (Math.floor(Math.random() * 50) + 101);
        reply = `Style Salon Gulberg mein Haircut, Beard Styling, aur Facial ke liye token ${randToken} milta hai. Timing: 10:00 AM - 9:00 PM. Aap kis service ke liye aana chahte hain?`;
      } else if (/\b(hospital|clinic|appointment|checkup)\b/i.test(msg)) {
        reply = "QueueIQ par Al-Shifa Clinic aur City Medical Center registered hain. Cardiology, Gynecology, Dermatology, Dentistry aur General OPD ke live tokens (Q-series) available hain. Kis clinic ya doctor ka token chahiye?";
      } else if (/\b(token|book|booking|queue)\b/i.test(msg)) {
        if (fullHistoryText.includes('nadra') || fullHistoryText.includes('nic')) {
          reply = "NADRA token ke liye homepage par 'NADRA Gulberg' search karein, apna WhatsApp number daalein aur N-token instant generate ho jayega.";
        } else if (fullHistoryText.includes('salon')) {
          reply = "Style Salon ka token book karne ke liye category mein 'Beauty' ya search mein 'Style Salon' choose karein!";
        } else {
          reply = "Token book karne ke liye search bar mein clinic ya service ka naam search karein (maslan 'Al-Shifa Clinic'), doctor select karein aur WhatsApp number enter karein. Aapko live token mil jayega!";
        }
      } else if (/\b(fee|fees|charges|price|paisa|cost)\b/i.test(msg)) {
        reply = "Consultation fees:\n• Dr. Ayesha Khan (Gynecology): Rs. 500\n• Dr. Rabia Hassan (Cardiology): Rs. 1800\n• Dr. Zoya Ahmed (Dermatology): Rs. 1400\n• Dr. Hina Yousuf (Dentist): Rs. 1200\n• NADRA NIC processing: Rs. 1000";
      } else if (/\b(timing|time|hours|open|kab)\b/i.test(msg)) {
        reply = "Timings:\n• Al-Shifa Clinic: 9:00 AM - 9:00 PM (Dr. Ayesha Demo Live: 2:00 PM - 3:00 AM)\n• NADRA Gulberg: 8:00 AM - 4:00 PM\n• Style Salon: 10:00 AM - 9:00 PM";
      } else if (/^(hi|hello|hey|salam|assalam|aoa|salam\s*alaikum|assalam-o-alaikum)$/i.test(msg) || /^(hi|hello|hey|salam)\b/i.test(msg)) {
        reply = "Walaikum Assalam! QueueIQ Assistant mein khush-aamdeed. Aapko kis cheez ka live token chahiye? Hospital/Clinic, NADRA, ya Salon? 😊";
      } else {
        reply = "Jee farmayein! Main QueueIQ AI Assistant hoon. Main aapko Al-Shifa Clinic doctors, NADRA Gulberg NIC tokens, aur Style Salon bookings mein guide kar sakta hoon. Aapko kis service ke baare mein jan-na hai?";
      }

      return NextResponse.json({ message: reply, reply });
    }
  } catch (e: any) {
    return NextResponse.json({
      message: "Jee bolen, kis cheez ka token chahiye? Hospital (Al-Shifa), Nadra, ya Salon? 😊",
      reply: "Jee bolen, kis cheez ka token chahiye? Hospital (Al-Shifa), Nadra, ya Salon? 😊"
    });
  }
}
