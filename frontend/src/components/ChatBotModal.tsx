"use client";

import { FormEvent, useState, useEffect, useRef } from "react";
import { CheckCheck, Mic, Paperclip, Send, Smile, X } from "lucide-react";
import { groqService, ChatHistory } from "@/services/groqService";

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

type ChatMessage = {
  id: string | number;
  text: string;
  sender: "user" | "bot";
  time: Date;
};

type ChatBotModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function ChatBotModal({ isOpen, onClose }: ChatBotModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      text: "Assalamualaikum! 🙏 Aap kis zuban mein baat karna pasand karenge?\n\nEnglish ya Urdu? / انگریزی یا اردو؟\n\nReply: ENGLISH or URDU",
      sender: "bot",
      time: new Date(),
    },
  ]);
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistory>([]);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<"en" | "ur" | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleLocationClick = () => {
    if (!navigator.geolocation) {
      setError("Location not available");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        handleSendMessage(
          `LOCATION:${coords.latitude},${coords.longitude}`
        );
      },
      () => {
        setError("Could not get your location");
      }
    );
  };

  const handleSendMessage = async (text?: string) => {
    const msgText = text || message.trim();

    if (!msgText) return;

    setError(null);

    const lower = msgText.toLowerCase().trim();

    // Language selection
    if (lower === "english" || lower === "en") {
      setLanguage("en");
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          text: msgText,
          sender: "user",
          time: new Date(),
        },
        {
          id: Date.now() + 1,
          text: "Perfect! 🎯 How can I help you with your appointment or token today?",
          sender: "bot",
          time: new Date(),
        },
      ]);
      setMessage("");
      return;
    }

    if (lower === "urdu" || lower === "ur") {
      setLanguage("ur");
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          text: msgText,
          sender: "user",
          time: new Date(),
        },
        {
          id: Date.now() + 1,
          text: "بہترین! 🎯 میں آپ کے اپوائنٹمنٹ یا ٹوکن میں کیسے مدد کر سکتا ہوں؟",
          sender: "bot",
          time: new Date(),
        },
      ]);
      setMessage("");
      return;
    }

    if (!language) {
      setError("پہلے زبان منتخب کریں / Please select a language first");
      return;
    }

    // Add user message
    const userMsg: ChatMessage = {
      id: Date.now(),
      text: msgText,
      sender: "user",
      time: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setMessage("");
    setIsTyping(true);

    try {
      // Build chat history with new message
      const newHistory: ChatHistory = [
        ...chatHistory,
        { role: "user", content: msgText },
      ];

      // Get bot response with Groq
      const reply = await groqService.sendMessage(
        msgText,
        newHistory,
        language === "ur" ? "ur" : "en",
        hospitalsData
      );

      // Add bot response
      const botMsg: ChatMessage = {
        id: Date.now() + 1,
        text: reply,
        sender: "bot",
        time: new Date(),
      };

      setMessages((prev) => [...prev, botMsg]);

      // Update chat history
      setChatHistory([...newHistory, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to get response"
      );
      const errorMsg: ChatMessage = {
        id: Date.now() + 1,
        text: language === "ur" 
          ? "معافی چاہتا ہوں، کوئی خرابی پیش آئی۔ دوبارہ کوشش کریں۔"
          : "Sorry, I encountered an error. Please try again.",
        sender: "bot",
        time: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleSendMessage();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-end justify-end bg-black/20 p-4 md:items-center md:justify-center">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-[#E5DDD5] shadow-2xl">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 bg-[#075E54] px-4 py-3 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#128C7E] text-sm font-semibold">
              QA
            </div>
            <div>
              <h1 className="text-base font-semibold">QueueIQ AI</h1>
              <p className="flex items-center gap-1.5 text-xs text-white/80">
                <span className="h-2 w-2 rounded-full bg-[#25D366]" />
                Online
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-white/10"
            aria-label="Close chat"
          >
            <X size={20} />
          </button>
        </header>

        {/* Messages Area */}
        <div
          className="flex h-[400px] flex-col space-y-2 overflow-y-auto bg-[#E5DDD5] p-4 sm:p-4"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, rgba(117, 96, 77, 0.08) 0 2px, transparent 2px), radial-gradient(circle at 80% 65%, rgba(117, 96, 77, 0.07) 0 1px, transparent 1px), linear-gradient(135deg, transparent 46%, rgba(117, 96, 77, 0.045) 47%, transparent 48%)",
            backgroundSize: "54px 54px, 72px 72px, 38px 38px",
          }}
          aria-live="polite"
        >
          {messages.map((item) => (
            <div
              key={item.id}
              className={`flex ${
                item.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`relative max-w-[85%] rounded-lg px-3 py-2 text-sm text-[#303030] shadow-sm before:absolute before:top-0 before:h-3 before:w-3 before:content-[''] ${
                  item.sender === "user"
                    ? "rounded-tr-none bg-[#DCF8C6] before:-right-1.5 before:bg-[#DCF8C6] before:[clip-path:polygon(0_0,100%_0,0_100%)]"
                    : "rounded-tl-none bg-white before:-left-1.5 before:bg-white before:[clip-path:polygon(0_0,100%_0,100%_100%)]"
                } ${item.sender === "user" ? "bg-[#DCF8C6]" : "bg-white"}`}
              >
                <p className="break-words whitespace-pre-wrap">{item.text}</p>
                <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#667781]">
                  {item.time.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {item.sender === "bot" ? (
                    <CheckCheck size={14} className="text-[#53BDEB]" />
                  ) : null}
                </p>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs text-[#667781] shadow-sm">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#667781] [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#667781] [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#667781]" />
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-[#EF4444]/10 px-3 py-2 text-xs text-[#EF4444]">
                {error}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-1.5 bg-[#F0F2F5] p-2.5"
        >
          <button
            type="button"
            aria-label="Add emoji"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#54656F] transition hover:bg-[#E1E5E8]"
          >
            <Smile size={21} />
          </button>
          <button
            type="button"
            onClick={handleLocationClick}
            aria-label="Share location"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#54656F] transition hover:bg-[#E1E5E8]"
          >
            <Paperclip size={20} />
          </button>
          <input
            type="text"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={language ? "Type a message..." : "Select language..."}
            aria-label="Message"
            className="min-w-0 flex-1 rounded-full border border-transparent bg-white px-4 py-2.5 text-sm text-[#303030] outline-none placeholder:text-[#667781] focus:border-[#25D366]"
            disabled={isTyping}
          />
          <button
            type="submit"
            aria-label="Send message"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white transition hover:bg-[#20BD5A] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!message.trim() || isTyping}
          >
            {message.trim() ? (
              <Send size={18} />
            ) : (
              <Mic size={20} />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
