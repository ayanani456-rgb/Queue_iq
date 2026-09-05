"use client";

import { FormEvent, useState, useEffect, useRef } from "react";
import { CheckCheck, Mic, Paperclip, Send, Smile, X } from "lucide-react";

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
          text: "Perfect! 🎯 How can I help you with your appointment or token today? / آپ کے ٹوکن یا اپائنٹمنٹ کے بارے میں میں آپ کی کیسے مدد کر سکتا ہوں؟",
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
          text: "بہترین! 🎯 میں آپ کے ٹوکن یا اپائنٹمنٹ کے بارے میں آپ کی مدد کر سکتا ہوں۔ براہ کرم اپنا سوال پوچھیں۔ / Perfect! Ask me anything about your appointment.",
          sender: "bot",
          time: new Date(),
        },
      ]);
      setMessage("");
      return;
    }

    if (!language) {
      setError("Please select a language first (ENGLISH or URDU)");
      return;
    }

    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        text: msgText,
        sender: "user",
        time: new Date(),
      },
    ]);
    setMessage("");
    setIsTyping(true);

    try {
      // Convert messages to backend format, filtering out initial language prompts
      const history = messages
        .filter((m) => {
          const text = m.text.toLowerCase();
          return !text.includes("assalamualaikum") && !text.includes("perfect") && !text.includes("بہترین");
        })
        .map((m) => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.text,
        }));

      // Call backend chatbot endpoint
      const response = await fetch("/api/chatbot/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: msgText,
          language: language || "en",
          history: history,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: data.reply,
          sender: "bot",
          time: new Date(),
        },
      ]);
    } catch (err) {
      console.error("Chat error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to send message. Please try again."
      );

      // Add error message to chat
      const errorMsg =
        language === "ur"
          ? "معافی چاہتا ہوں، کچھ غلط ہوگیا۔ براہ کرم دوبارہ کوشش کریں۔"
          : "Sorry, something went wrong. Please try again.";

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          text: errorMsg,
          sender: "bot",
          time: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
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
              <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded-lg text-sm max-w-[85%]">
                {error}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleFormSubmit} className="border-t border-[#CCCCCC] bg-white p-2.5 flex items-center gap-1">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#075E54] hover:bg-gray-100"
            aria-label="Attach file"
          >
            <Paperclip size={20} />
          </button>

          <input
            type="text"
            placeholder={
              language
                ? language === "ur"
                  ? "اپنا سوال لکھیں..."
                  : "Type your message..."
                : "Select language first..."
            }
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isTyping}
            className="flex-1 outline-none px-3 py-2 text-sm disabled:opacity-50 bg-transparent"
          />

          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#075E54] hover:bg-gray-100"
            aria-label="Microphone"
          >
            <Mic size={20} />
          </button>

          <button
            type="button"
            onClick={handleLocationClick}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#075E54] hover:bg-gray-100"
            aria-label="Emoji"
          >
            <Smile size={20} />
          </button>

          <button
            type="submit"
            disabled={isTyping || !message.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#075E54] hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Send message"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
