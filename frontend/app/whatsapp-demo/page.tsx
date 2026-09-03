"use client";

import { useState } from "react";
import ChatWindow from "@/components/WhatsAppBot/ChatWindow";

const hospitalsData = [
  {
    name: "Ziauddin Hospital North Nazimabad",
    doctors: [
      { name: "Dr. Ayesha Khan", speciality: "Dermatology", fee: 1500, currentToken: "T-115", yourToken: "T-118", wait: "16 min", available: "Kal 10AM-2PM" },
      { name: "Dr. Saleem Iqbal", speciality: "Cardiology", fee: 2000, currentToken: "T-42", yourToken: "T-45", wait: "32 min", available: "Aaj 9AM-5PM" },
    ],
  },
  {
    name: "Mamji Hospital",
    doctors: [
      { name: "Dr. Fatima Noor", speciality: "General", fee: 1000, currentToken: "T-28", yourToken: "T-31", wait: "20 min", available: "Aaj 4PM-8PM" },
    ],
  },
];

type ChatHistoryItem = { role: string; content: string };
type UserLocation = { lat: number; lng: number };

async function callRealAI(userMessage: string, lang: string, history: ChatHistoryItem[], userLocation: UserLocation | null) {
  const response = await fetch("/api/groq", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: userMessage,
      language: lang,
      history: history.slice(-8),
      userLocation,
      hospitalsData,
    }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "GROQ request failed");
  }

  return data.reply || "Samajh nahi aaya. 1: Nearby, 2: Doctor, 3: Token likhein";
}

type Message = {
  id: number;
  text: string;
  sender: "user" | "bot";
  time: Date;
  showPaymentButton?: boolean;
};

export default function WhatsAppDemoPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Assalamualaikum! English ya Urdu? / انگریزی یا اردو؟ Reply: ENGLISH or URDU",
      sender: "bot",
      time: new Date(),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [language, setLanguage] = useState("en");
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);

  const handleCompletePayment = () => {
    const existingBookings = JSON.parse(localStorage.getItem("myBookings") || "[]");
    const existingQueueiq = JSON.parse(localStorage.getItem("queueiq_my_bookings") || "[]");
    const randomNum = Math.floor(100 + Math.random() * 900);
    const token = `H-${randomNum}`;
    const newBooking = {
      id: Date.now(),
      token: token,
      tokenNumber: token,
      token_number: token,
      yourToken: token,
      voucherId: `Q-${randomNum}-${Date.now().toString().slice(-4)}`,
      organization: "Ziauddin Hospital North Nazimabad",
      organization_name: "Ziauddin Hospital North Nazimabad",
      orgName: "Ziauddin Hospital North Nazimabad",
      salon: "Ziauddin Hospital North Nazimabad",
      service: "Doctor Appointment",
      category: "Doctor Appointment",
      price: 500,
      phone: "03XXXXXXXXX",
      status: "Confirmed",
      payment: "online",
      payment_status: "paid",
      paymentStatus: "Paid",
      date: "Today",
      time: "10:30 AM",
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem("myBookings", JSON.stringify([...existingBookings, newBooking]));
    localStorage.setItem("queueiq_my_bookings", JSON.stringify([...existingQueueiq, newBooking]));
    setMessages((previous) => [
      ...previous,
      {
        id: Date.now() + 1,
        text: `Booking confirmed for Ziauddin Hospital North Nazimabad! 🎉\nYour Token: ${token}\nTime: 10:30 AM ✅`,
        sender: "bot",
        time: new Date(),
      },
    ]);
  };

  const handleSendMessage = async (text: string) => {
    const lower = text.toLowerCase().trim();
    let currentLocation = userLoc;

    if (lower.startsWith("location:")) {
      const [lat, lng] = text.slice("LOCATION:".length).split(",").map(Number);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        currentLocation = { lat, lng };
        setUserLoc(currentLocation);
      }
    }

    setMessages((previous) => [
      ...previous,
      { id: Date.now(), text, sender: "user", time: new Date() },
    ]);
    setIsTyping(true);

    const newHistory = [...chatHistory, { role: "user", content: text }];
    setChatHistory(newHistory);

    const addBotMessage = (reply: string) => {
      setMessages((previous) => [
        ...previous,
        { id: Date.now() + 1, text: reply, sender: "bot", time: new Date() },
      ]);
    };

    if (lower === "english" || lower === "en") {
      setLanguage("en");
      setIsTyping(false);
      return;
    }

    if (lower === "urdu" || lower === "ur") {
      setLanguage("ur");
      setIsTyping(false);
      return;
    }

    try {
      const reply = await callRealAI(text, language, newHistory, currentLocation);
      const bookingIntent = ["book", "confirm", "haan"].some((keyword) => lower.includes(keyword));
      setMessages((previous) => [
        ...previous,
        {
          id: Date.now() + 1,
          text: reply,
          sender: "bot",
          time: new Date(),
          showPaymentButton: bookingIntent,
        },
      ]);
      setChatHistory([...newHistory, { role: "assistant", content: reply }]);
    } catch (error) {
      console.error("Failed to get GROQ response:", error);
      const fallback = "Sorry yaar, thori technical problem aa gayi 😅 Dobara try karo?";
      addBotMessage(fallback);
      setChatHistory([...newHistory, { role: "assistant", content: fallback }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <main className="mx-auto max-w-md p-4">
      <ChatWindow
        messages={messages}
        onSendMessage={handleSendMessage}
        onPayment={handleCompletePayment}
        isTyping={isTyping}
      />
    </main>
  );
}
