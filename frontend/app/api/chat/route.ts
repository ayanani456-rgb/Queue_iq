import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nwrfpdwacfxttxfjwzxx.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_zjRmE547dWVVd1Q54uIDNQ_QpX5CqIk";

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || "";

    // Fetch doctors and live serving tokens from Supabase
    let doctorsList: any[] = [];
    let activeTokens: any[] = [];

    try {
      if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        const [docRes, tokenRes] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/doctors?select=id,name,specialty,fee,schedule,organization_id`, {
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
          }),
          fetch(`${SUPABASE_URL}/rest/v1/tokens?select=token_number,status,doctor_id,organization_id&order=created_at.asc`, {
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
          })
        ]);

        if (docRes.ok) doctorsList = await docRes.json();
        if (tokenRes.ok) activeTokens = await tokenRes.json();
      }
    } catch (e) {
      console.log("Supabase fetch failed, fallback active");
    }

    // Baseline live token mapping if DB query is empty
    const getDoctorInfo = (nameQuery: string, defaultName: string, defaultSpecialty: string, defaultFee: number, defaultToken: string, defaultTiming: string) => {
      const doc = doctorsList.find((d: any) => d.name?.toLowerCase().includes(nameQuery.toLowerCase()) && (d.organization_id === 'bcb69e0a-b1e1-4f03-8184-1017d8e8e9eb' || !d.organization_id));
      const docId = doc?.id;
      const liveServing = activeTokens.find((t: any) => t.doctor_id === docId && (t.status === 'Serving' || t.status === 'Inside'))?.token_number;
      const liveAny = activeTokens.filter((t: any) => t.doctor_id === docId && ['Serving', 'Waiting', 'Paused'].includes(t.status));
      const servingToken = liveServing || (liveAny.length > 0 ? liveAny[0].token_number : defaultToken);

      // Accurate overrides for Al-Shifa
      const fee = nameQuery === 'ayesha' ? 500 : (doc?.fee || defaultFee);
      const specialty = nameQuery === 'ayesha' ? 'Gynecologist' : (doc?.specialty || defaultSpecialty);
      const name = doc?.name || defaultName;
      const timing = nameQuery === 'ayesha' ? '02:00 PM - 03:00 AM' : (doc?.schedule?.when || doc?.schedule?.label || defaultTiming);

      return { name, specialty, fee, servingToken, timing, docId };
    };

    const drAyesha = getDoctorInfo('ayesha', 'Dr. Ayesha Khan', 'Gynecologist', 500, 'T-127', '02:00 PM - 03:00 AM');
    const drRabia = getDoctorInfo('rabia', 'Dr. Rabia Hassan', 'Cardiologist', 1800, 'Q-112', '09:00 AM - 05:00 PM');
    const drSalman = getDoctorInfo('salman', 'Dr. Salman Iqbal', 'Cardiologist', 2000, 'Q-115', '10:00 AM - 04:00 PM');
    const drZoya = getDoctorInfo('zoya', 'Dr. Zoya Ahmed', 'Dermatologist', 1400, 'Q-114', '02:00 PM - 08:00 PM');
    const drHina = getDoctorInfo('hina', 'Dr. Hina Yousuf', 'Dentist', 1200, 'None (0 waiting)', '11:00 AM - 07:00 PM');

    const systemPrompt = {
      role: "system",
      content: `
You are QueueIQ AI - SUPER SMART Assistant for ENTIRE QueueIQ Pakistan!

LIVE DOCTORS DATA & SERVING TOKENS:
• Dr. Ayesha Khan (Gynecologist): Fee Rs. 500, Timing 02:00 PM - 03:00 AM, Current Serving: T-127
• Dr. Rabia Hassan (Cardiologist): Fee Rs. 1800, Current Serving: Q-112, Waiting: Q-113
• Dr. Salman Iqbal (Cardiologist): Fee Rs. 2000, Current Serving: Q-115
• Dr. Zoya Ahmed (Dermatologist): Fee Rs. 1400, Current Serving: Q-114
• Dr. Hina Yousuf (Dentist): Fee Rs. 1200

ORGANIZATIONS:
• Al-Shifa Clinic (Hospital/Clinic) - Cardiology, Gynecology, Dermatology, Dentistry (Token format: Q-series / T-series)
• NADRA Gulberg (Government) - NIC, B-Form, FRC (Token format: N-series, 8AM-4PM, Fee Rs. 1000)
• Style Salon Gulberg (Beauty/Salon) - Haircut, Beard, Facial (Token format: S-series, 10AM-9PM)
• City Medical Center - General OPD & Lab tests

CRITICAL RULES:
1. Dr. Ayesha is Gynecologist (Fee: Rs. 500, Timing: 02:00 PM - 03:00 AM, Serving: T-127). Never say Cardiologist for Dr. Ayesha!
2. If user says "jee", "le chalo", "hn", "book krdo" after discussing a doctor, guide them to book that doctor on homepage.
3. Roman Urdu + English friendly conversation style.
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
      // SMART CONVERSATIONAL ENGINE WITH MULTI-TURN CONTEXT TRACKING
      const msg = lastMsg.trim().toLowerCase();

      // Find previous assistant message for direct dialogue continuity
      const prevAssistantMsg = [...messages.slice(0, -1)].reverse().find((m: any) => (m.role === 'assistant' || m.sender === 'bot'))?.content?.toLowerCase() || '';

      // Track recent entities from conversation history (newest to oldest)
      let selectedDoctor: string | null = null;
      let lastContext: 'ayesha' | 'rabia' | 'salman' | 'zoya' | 'hina' | 'alshifa' | 'nadra' | 'salon' | 'hospital' | null = null;

      for (let i = messages.length - 1; i >= 0; i--) {
        const itemText = (messages[i].content || messages[i].text || "").toLowerCase();
        if (itemText.includes('ayesha')) {
          selectedDoctor = drAyesha.name;
          lastContext = 'ayesha';
          break;
        } else if (itemText.includes('rabia')) {
          selectedDoctor = drRabia.name;
          lastContext = 'rabia';
          break;
        } else if (itemText.includes('salman')) {
          selectedDoctor = drSalman.name;
          lastContext = 'salman';
          break;
        } else if (itemText.includes('zoya')) {
          selectedDoctor = drZoya.name;
          lastContext = 'zoya';
          break;
        } else if (itemText.includes('hina')) {
          selectedDoctor = drHina.name;
          lastContext = 'hina';
          break;
        } else if (itemText.includes('al shifa') || itemText.includes('al-shifa') || itemText.includes('shifa')) {
          lastContext = 'alshifa';
          break;
        } else if (itemText.includes('nadra') || itemText.includes('nic') || itemText.includes('b-form') || itemText.includes('cnic')) {
          lastContext = 'nadra';
          break;
        } else if (itemText.includes('salon') || itemText.includes('hair') || itemText.includes('facial')) {
          lastContext = 'salon';
          break;
        } else if (itemText.includes('hosp') || itemText.includes('clinic')) {
          lastContext = 'hospital';
          break;
        }
      }

      let reply = "";

      const isAffirmation = /^(jee|ji|haan|han|hn|yes|yep|yeah|chalo|le\s*chalo|le\s*jao|open\s*karo|open\s*krdo|zaroor|sure|ok|okay|theek\s*hai)$/i.test(msg) || /\b(le\s*chalo|le\s*jao|open\s*krdo|open\s*karo)\b/i.test(msg);
      const isBookingIntent = /\b(book|booking|book\s*krdo|book\s*kardo|token\s*book|token\s*chahiye|token\s*dedo|hn|haan|han|yes|ok|theek\s*hai|sahi\s*hai|kar\s*do|kr\s*do|bhej\s*do|book\s*kr\s*do|kar\s*dein|kr\s*dein)\b/i.test(msg);
      const isExplicitNadra = /\b(nadra|nic|cnic|b[-\s]?form|frc)\b/i.test(msg);
      const isExplicitSalon = /\b(salon|hair|facial|beard|spa)\b/i.test(msg);

      // 1. Payment Questions (e.g. "or payment", "payment kaise", "jazzcash", "voucher", "fee")
      const isPaymentQuery = /\b(payment|pay|jazzcash|easypaisa|voucher|paisa|fees|charges|online\s*pay|cash|kaise\s*pay|payment\s*method)\b/i.test(msg) || msg.includes('payment');
      if (isPaymentQuery) {
        const docName = selectedDoctor || (lastContext === 'rabia' ? drRabia.name : drAyesha.name);
        const docFee = selectedDoctor === drRabia.name ? drRabia.fee : drAyesha.fee;
        reply = `QueueIQ par payment ke 2 asaan tareeqay hain:

1. 📱 Pay Online (JazzCash / EasyPaisa / Bank):
• Booking par aapko 5-digit Voucher ID (e.g. VCH-84920) milegi.
• JazzCash ya EasyPaisa (0300-1234567) par Voucher ID mention karke transfer karein aur token live confirm ho jayega.

2. 🏥 Pay at Reception:
• Clinic aane par reception counter par cash ya card se Rs. ${docFee} pay karein.

Aapka WhatsApp number provide karein toh main ${docName} ke liye live token aur payment voucher abhi generate kar deta hoon! 😊`;
        return NextResponse.json({ message: reply, reply });
      }

      // Check if user provided a phone number or wants instant booking in chat
      const phoneMatch = msg.match(/03\d{9}/) || msg.match(/03\d{2}[-\s]?\d{7}/);
      const isDirectBookRequest = (phoneMatch !== null) || (isBookingIntent && (msg.includes('krdo') || msg.includes('bana do') || msg.includes('dedo') || msg.includes('chahiye')));

      if (isDirectBookRequest && (selectedDoctor || lastContext || msg.includes('ayesha') || msg.includes('rabia') || msg.includes('shifa'))) {
        const docName = selectedDoctor || (msg.includes('rabia') ? drRabia.name : drAyesha.name);
        const isFuture = msg.includes('kal') || msg.includes('tomorrow') || msg.includes('future') || msg.includes('agle');
        const tokenPrefix = isFuture ? 'F' : (docName.includes('Ayesha') ? 'T' : 'Q');
        const generatedToken = `${tokenPrefix}-${Math.floor(128 + Math.random() * 20)}`;
        const voucherId = `VCH-${Math.floor(10000 + Math.random() * 90000)}`;
        const appointmentDate = isFuture ? 'Tomorrow (May 14, 2026)' : 'Today (May 13, 2026)';
        const appointmentTime = docName.includes('Ayesha') ? '03:00 PM' : '11:00 AM';
        const docFee = docName.includes('Rabia') ? 1800 : 500;
        const currentServing = docName.includes('Rabia') ? 'Q-112' : 'T-127';
        const userPhone = phoneMatch ? phoneMatch[0].replace(/\s|-/g, '') : '03001234567';

        const calLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Appointment: Al-Shifa Clinic (${docName})`)}&details=${encodeURIComponent(`Token: ${generatedToken} | Voucher: ${voucherId} | Fee: Rs. ${docFee} | QueueIQ`)}&location=${encodeURIComponent('Al-Shifa Clinic, Lahore')}`;

        reply = `🎉 Mubarak ho! Aapka token confirm ho chuka hai:

🎟️ Token Number: ${generatedToken}
🧾 Voucher ID: ${voucherId}
👨‍⚕️ Doctor: ${docName} (Al-Shifa Clinic)
📅 Date: ${appointmentDate} at ${appointmentTime}
💰 Consultation Fee: Rs. ${docFee}
⏳ Live Queue: Current Serving ${currentServing} (Estimated wait: ~15 min)

💳 Payment Options:
1. Pay Online: JazzCash/EasyPaisa (0300-1234567) using Voucher ID ${voucherId}
2. Pay at Reception: Show Voucher ID on arrival.

📅 Add to Calendar:
${calLink}

Aapka token 'My Bookings' mein bhi save kar diya gaya hai! ✅`;

        const bookingObj = {
          token: generatedToken,
          yourToken: generatedToken,
          voucherId: voucherId,
          orgName: 'Al-Shifa Clinic',
          doctorName: docName,
          category: 'Health',
          date: isFuture ? '2026-05-14' : '2026-05-13',
          time: appointmentTime,
          phone: userPhone,
          paymentStatus: 'Pending',
          type: 'clinic',
          fee: docFee
        };

        return NextResponse.json({ message: reply, reply, booking: bookingObj });
      }

      // 2. Navigation / Affirmation handling ("jee", "le chalo", "haan")
      if (isAffirmation && (prevAssistantMsg.includes('homepage par le chalun') || prevAssistantMsg.includes('homepage par'))) {
        const docName = selectedDoctor || 'Dr. Ayesha Khan';
        reply = `Beshak! Main aapko homepage par guide kar raha hoon. Bas 'Al-Shifa Clinic' > '${docName}' select karein, apna WhatsApp number daalein aur live token instantly book kar lein! Ya apna WhatsApp number yahan likhein toh main chat mein hi book kar dun! 😊`;
      }
      // 3. Booking Intent guidance
      else if ((isBookingIntent || isAffirmation) && !isExplicitNadra && !isExplicitSalon) {
        if (selectedDoctor || lastContext === 'ayesha' || lastContext === 'rabia' || lastContext === 'salman' || lastContext === 'zoya' || lastContext === 'hina' || lastContext === 'alshifa' || lastContext === 'hospital') {
          const docName = selectedDoctor || (lastContext === 'rabia' ? drRabia.name : drAyesha.name);
          reply = `${docName} ka token book karne ke liye aap apna WhatsApp number (maslan 03001234567) yahan send karein, main direct token + payment voucher generate kar dunga! Ya homepage par jaana chahte hain?`;
        } else if (lastContext === 'nadra') {
          reply = "NADRA Gulberg mein NIC / B-Form ke liye token book karne ke liye homepage par 'NADRA Gulberg' search karein aur apna WhatsApp number enter karein. Token N-series generate ho jayega.";
        } else if (lastContext === 'salon') {
          reply = "Style Salon Gulberg ka token book karne ke liye homepage par Style Salon select karein aur appointment confirm karein.";
        } else {
          reply = "Token book karne ke liye homepage par Al-Shifa Clinic ya apni pasandeeda service choose karein, doctor select karein aur apna WhatsApp number enter karein!";
        }
      }
      // 4. Doctor Inquiries (Dr. Ayesha, Dr. Rabia, Dr. Salman, Dr. Zoya, Dr. Hina)
      else if (/\b(ayesha|gynae|gynecolog)/i.test(msg)) {
        reply = `${drAyesha.name} (${drAyesha.specialty}) - Fee Rs. ${drAyesha.fee} - Timing ${drAyesha.timing} - Current Serving: ${drAyesha.servingToken}. Kya aap inka token book karna chahte hain?`;
      } else if (/\b(rabia|cardio.*rabia)/i.test(msg)) {
        reply = `${drRabia.name} (${drRabia.specialty}) - Fee Rs. ${drRabia.fee} - Timing ${drRabia.timing} - Current Serving: ${drRabia.servingToken} (Waiting: Q-113).`;
      } else if (/\b(salman)/i.test(msg)) {
        reply = `${drSalman.name} (${drSalman.specialty}) - Fee Rs. ${drSalman.fee} - Timing ${drSalman.timing} - Current Serving: ${drSalman.servingToken}.`;
      } else if (/\b(zoya|derma.*zoya)/i.test(msg)) {
        reply = `${drZoya.name} (${drZoya.specialty}) - Fee Rs. ${drZoya.fee} - Timing ${drZoya.timing} - Current Serving: ${drZoya.servingToken}.`;
      } else if (/\b(hina|dent.*hina)/i.test(msg)) {
        reply = `${drHina.name} (${drHina.specialty}) - Fee Rs. ${drHina.fee} - Timing ${drHina.timing} - Current Serving: ${drHina.servingToken}.`;
      }
      // 5. Al-Shifa Clinic
      else if (/\b(al[-\s]?shifa|shifa)\b/i.test(msg)) {
        reply = "Al-Shifa Clinic mein live doctors:\n• Dr. Ayesha Khan (Gynecologist - Serving: T-127, Fee: Rs. 500)\n• Dr. Rabia Hassan (Cardiologist - Serving: Q-112, Fee: Rs. 1800)\n• Dr. Salman Iqbal (Cardiologist - Serving: Q-115, Fee: Rs. 2000)\n• Dr. Zoya Ahmed (Dermatologist - Serving: Q-114, Fee: Rs. 1400)\n• Dr. Hina Yousuf (Dentist - Fee: Rs. 1200)\nKis doctor ka token book karna chahte hain?";
      }
      // 6. Hospital / Clinic with Typo Handling ("hospitl", "hosptal", "hosp", "clinc")
      else if (/\b(hosp|hospital|hospitl|hosptal|hospitel|hostipal|clinic|clinc|clnic)\b/i.test(msg) || msg.includes('hosp')) {
        reply = "QueueIQ par Al-Shifa Clinic aur City Medical Center registered hain. Al-Shifa mein Dr. Ayesha Khan (Gynecologist), Dr. Rabia Hassan (Cardiologist), Dr. Zoya Ahmed (Dermatologist) ke live tokens available hain. Kis doctor ka appointment chahiye?";
      }
      // 7. City Medical Center
      else if (/\b(city[-\s]?medical|city\s*med)\b/i.test(msg)) {
        reply = "City Medical Center mein General OPD aur Diagnostic Lab tests available hain (9:00 AM - 9:00 PM). Token Q-series mein generate hota hai.";
      }
      // 8. Generic Doctor query
      else if (/\b(dr\.?|doctor|doctors)\b/i.test(msg)) {
        reply = "Al-Shifa Clinic ke available doctors:\n• Dr. Ayesha Khan (Gynecology - Serving: T-127)\n• Dr. Rabia Hassan (Cardiology - Serving: Q-112)\n• Dr. Salman Iqbal (Cardiology - Serving: Q-115)\n• Dr. Zoya Ahmed (Dermatology - Serving: Q-114)\n• Dr. Hina Yousuf (Dentistry)\nAap kiske sath checkup karwana chahte hain?";
      }
      // 9. NADRA inquiries
      else if (isExplicitNadra) {
        const randToken = "N-" + (Math.floor(Math.random() * 80) + 120);
        reply = `NADRA Gulberg Centre mein New NIC, Renewal, aur B-Form ke liye token ${randToken} issue hota hai. Timing: 8:00 AM - 4:00 PM. Zaruri documents: Original CNIC / B-Form + Photographs. Fees: Rs. 1000.`;
      }
      // 10. Salon inquiries
      else if (isExplicitSalon) {
        const randToken = "S-" + (Math.floor(Math.random() * 50) + 101);
        reply = `Style Salon Gulberg mein Haircut, Beard Styling, aur Facial ke liye token ${randToken} milta hai. Timing: 10:00 AM - 9:00 PM.`;
      }
      // 11. Fees
      else if (/\b(fee|fees|charges|price|paisa|cost)\b/i.test(msg)) {
        reply = `Consultation fees:\n• Dr. Ayesha Khan (Gynecology): Rs. ${drAyesha.fee}\n• Dr. Rabia Hassan (Cardiology): Rs. ${drRabia.fee}\n• Dr. Salman Iqbal (Cardiology): Rs. ${drSalman.fee}\n• Dr. Zoya Ahmed (Dermatology): Rs. ${drZoya.fee}\n• Dr. Hina Yousuf (Dentist): Rs. ${drHina.fee}\n• NADRA NIC fee: Rs. 1000`;
      }
      // 12. Timings
      else if (/\b(timing|time|hours|open|kab)\b/i.test(msg)) {
        reply = `Timings:\n• Al-Shifa Clinic (Dr. Ayesha Khan): ${drAyesha.timing}\n• Al-Shifa General: 09:00 AM - 09:00 PM\n• NADRA Gulberg: 08:00 AM - 04:00 PM\n• Style Salon: 10:00 AM - 09:00 PM`;
      }
      // 13. Greeting
      else if (/^(hi|hello|hey|salam|assalam|aoa|salam\s*alaikum|assalam-o-alaikum)$/i.test(msg) || /^(hi|hello|hey|salam)\b/i.test(msg)) {
        reply = "Walaikum Assalam! QueueIQ Assistant mein khush-aamdeed. Aapko kis cheez ka live token chahiye? Hospital/Clinic (Al-Shifa), NADRA, ya Salon? 😊";
      } else {
        reply = "Jee farmayein! Main QueueIQ AI Assistant hoon. Main aapko Al-Shifa Clinic (Dr. Ayesha, Dr. Rabia, Dr. Zoya), NADRA Gulberg NIC tokens, aur Style Salon bookings mein guide kar sakta hoon. Aapko kis service ke baare mein jan-na hai?";
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

