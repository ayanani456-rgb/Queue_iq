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

    // Try Groq, fallback to smart rule-based
    try {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) throw new Error("No GROQ_API_KEY");

      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [systemPrompt, ...messages.map((m: any) => ({ role: m.role || (m.sender === 'user' ? 'user' : 'assistant'), content: m.content || m.text || '' }))],
          temperature: 0.8,
          max_tokens: 400
        })
      });

      if (groqRes.ok) {
        const data = await groqRes.json();
        const reply = data.choices?.[0]?.message?.content;
        if (reply) return NextResponse.json({ message: reply, reply: reply });
      }
      throw new Error("Groq failed");
    } catch {
      // SMART FALLBACK - KNOWS ALL ORGS
      let reply = "";
      if (lastMsg.includes("hi") || lastMsg.includes("salam") || lastMsg.includes("hello")) {
        reply = "Walaikum Assalam! QueueIQ pe aapko kis cheez me help chahiye? Hospital token, Nadra NIC, ya Salon booking? 😊";
      } else if (lastMsg.includes("nadra") || lastMsg.includes("nic") || lastMsg.includes("b-form") || lastMsg.includes("cnic")) {
        reply = "Nadra Gulberg me NIC / B-Form / FRC ke liye token N-" + (Math.floor(Math.random() * 100) + 10) + " hai. Timing 8AM-4PM. Documents: Original CNIC/B-Form + photo. Fees 1000rs. Book kar dun?";
      } else if (lastMsg.includes("salon") || lastMsg.includes("hair") || lastMsg.includes("facial") || lastMsg.includes("cut")) {
        reply = "Style Salon Gulberg me Haircut, Facial, etc ke liye token S-" + (Math.floor(Math.random() * 100) + 10) + " milega. Timing 10AM-9PM. Kaunsi service chahiye?";
      } else if (lastMsg.includes("hospital") || lastMsg.includes("doctor") || lastMsg.includes("al shifa") || lastMsg.includes("city medical") || lastMsg.includes("token") || lastMsg.includes("ayesha") || lastMsg.includes("zia")) {
        reply = "Al Shifa / City Medical me Dr. Ayesha, Dr Ziauddin, Dr Bilal available hain. Token Q-" + (Math.floor(Math.random() * 100) + 100) + ". Date aur time bata dein? Clinic 9AM-9PM";
      } else {
        reply = "Jee bolen, kya help chahiye? Nadra NIC, Hospital token, ya Salon booking? Mai QueueIQ ka assistant hun, sab ka data hai mere paas! 😊";
      }
      return NextResponse.json({ message: reply, reply: reply });
    }

  } catch (e: any) {
    return NextResponse.json({
      message: "Jee bolen, kis cheez ka token chahiye? Hospital, Nadra, ya Salon? 😊",
      reply: "Jee bolen, kis cheez ka token chahiye? Hospital, Nadra, ya Salon? 😊"
    });
  }
}
