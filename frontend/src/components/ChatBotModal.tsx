"use client";

import { FormEvent, useState, useEffect, useRef } from "react";
import { CheckCheck, Globe, Mic, Paperclip, Send, Smile, X } from "lucide-react";

type ChatMessage = {
  id: string | number;
  text: string;
  sender: "user" | "bot";
  time: Date;
  showLanguageOptions?: boolean;
};

type ChatBotModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function ChatBotModal({ isOpen, onClose }: ChatBotModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      text: "Assalamualaikum! 🙏 Aap kis zuban mein baat karna pasand karenge?\n\nEnglish ya Urdu? / انگریزی یا اردو؟",
      sender: "bot",
      time: new Date(),
      showLanguageOptions: true,
    },
  ]);
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<"en" | "ur" | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSelectLanguage = (selectedLang: "en" | "ur") => {
    setLanguage(selectedLang);
    setError(null);
    const langLabel = selectedLang === "en" ? "English" : "اردو / Urdu";

    setMessages((prev) => [
      ...prev.map((m) => ({ ...m, showLanguageOptions: false })),
      {
        id: Date.now(),
        text: langLabel,
        sender: "user",
        time: new Date(),
      },
      {
        id: Date.now() + 1,
        text:
          selectedLang === "en"
            ? "Perfect! 🎯 How can I help you with your appointment, token booking, or queue wait time today?"
            : "بہترین! 🎯 میں آپ کے ٹوکن، اپائنٹمنٹ اور انتظار کے وقت کے بارے میں آپ کی کیسے مدد کر سکتا ہوں؟",
        sender: "bot",
        time: new Date(),
      },
    ]);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

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
    const msgText = (text !== undefined ? text : message).trim();

    if (!msgText) return;

    setError(null);

    const lower = msgText.toLowerCase().trim();

    // Check if user replied with language name explicitly
    if (lower === "english" || lower === "en") {
      handleSelectLanguage("en");
      setMessage("");
      return;
    }

    if (lower === "urdu" || lower === "ur" || lower === "اردو") {
      handleSelectLanguage("ur");
      setMessage("");
      return;
    }

    // Determine language if not already explicitly selected
    let currentLang = language;
    if (!currentLang) {
      const isUrduQuery =
        /[\u0600-\u06FF]/.test(msgText) ||
        /\b(kya|kaise|hai|salam|mujhe|doctor|token|apointment|chahiye|kitna|waqt|batao|shukriya)\b/i.test(msgText);
      currentLang = isUrduQuery ? "ur" : "en";
      setLanguage(currentLang);
    }

    const userNewMsg: ChatMessage = {
      id: Date.now(),
      text: msgText,
      sender: "user",
      time: new Date(),
    };

    const updatedMsgs = [...messages.map((m) => ({ ...m, showLanguageOptions: false })), userNewMsg];

    // Log full array of messages in console - Array(N)
    console.log("ChatBotModal sending messages array:", updatedMsgs);

    // Add user message
    setMessages(updatedMsgs);
    setMessage("");
    setIsTyping(true);

    try {
      // Convert messages to history format
      const history = updatedMsgs
        .filter((m) => !m.showLanguageOptions)
        .slice(-10)
        .map((m) => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.text,
        }));

      // Call chatbot API endpoint (Next.js route or backend)
      let replyText = "";
      const apiEndpoint = "/api/chat";

      try {
        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: history,
            message: msgText,
            language: currentLang,
            history: history.slice(0, -1),
          }),
        });

        if (response.ok) {
          const data = await response.json();
          replyText = data.reply || "";
        } else {
          // Fallback to /api/chatbot/chat if /api/chat returned non-ok
          const fallbackRes = await fetch("/api/chatbot/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: history,
              message: msgText,
              language: currentLang,
              history: history.slice(0, -1),
            }),
          });
          if (fallbackRes.ok) {
            const fbData = await fallbackRes.json();
            replyText = fbData.reply || "";
          }
        }
      } catch (networkErr) {
        console.warn("API route attempt failed, trying fallback:", networkErr);
      }

      if (!replyText) {
        replyText =
          currentLang === "ur"
            ? "Walaikum Assalam! Main QueueIQ Assistant hoon. Aap clinic, doctor ya token ke baare mein kuch bhi pooch sakte hain."
            : "Hello! I am your QueueIQ Assistant. You can ask me anything about clinic queues, doctors, and token booking.";
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: replyText,
          sender: "bot",
          time: new Date(),
        },
      ]);
    } catch (err: any) {
      console.error("Chat error:", err);
      const errorMsg =
        currentLang === "ur"
          ? "معافی چاہتا ہوں، نیٹ ورک میں مسئلہ آیا۔ براہ کرم دوبارہ کوشش کریں۔"
          : "Sorry, a network error occurred. Please try again.";

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
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSendMessage();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end justify-end bg-black/40 p-2 sm:p-4 md:items-center md:justify-center backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-[#E5DDD5] shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] border border-[#d1d7db]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-3 bg-[#075E54] px-4 py-3 text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#128C7E] text-sm font-bold text-white shadow-inner">
              QA
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">QueueIQ AI</h1>
              <p className="flex items-center gap-1.5 text-xs text-emerald-200">
                <span className="h-2 w-2 rounded-full bg-[#25D366] animate-pulse" />
                Online &bull; Available
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {language && (
              <button
                type="button"
                onClick={() => handleSelectLanguage(language === "en" ? "ur" : "en")}
                className="flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded-full transition text-emerald-100"
                title="Switch Language"
              >
                <Globe size={13} />
                <span>{language === "en" ? "English" : "اردو"}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/90 transition hover:bg-white/15 hover:text-white"
              aria-label="Close chat"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Messages Area */}
        <div
          className="flex h-[380px] sm:h-[420px] flex-col space-y-3 overflow-y-auto bg-[#E5DDD5] p-3 sm:p-4"
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
              className={`flex flex-col ${
                item.sender === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`relative max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm text-[#111b21] shadow-sm ${
                  item.sender === "user"
                    ? "rounded-tr-none bg-[#DCF8C6]"
                    : "rounded-tl-none bg-white"
                }`}
              >
                <p className="break-words whitespace-pre-wrap leading-relaxed">{item.text}</p>
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

              {/* Quick Language Selection Buttons */}
              {item.showLanguageOptions && !language && (
                <div className="flex flex-wrap gap-2 mt-2 px-1">
                  <button
                    type="button"
                    onClick={() => handleSelectLanguage("en")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-[#075E54] border border-[#075E54]/30 hover:bg-[#075E54] hover:text-white transition shadow-xs text-xs font-semibold"
                  >
                    🇬🇧 English
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectLanguage("ur")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-[#075E54] border border-[#075E54]/30 hover:bg-[#075E54] hover:text-white transition shadow-xs text-xs font-semibold"
                  >
                    🇵🇰 اردو / Roman Urdu
                  </button>
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-none bg-white px-3.5 py-2 text-xs text-[#667781] shadow-sm">
                <span className="h-2 w-2 animate-bounce rounded-full bg-[#128C7E] [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[#128C7E] [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[#128C7E]" />
                <span className="text-[11px] text-[#667781] ml-1">QueueIQ AI is typing...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-start">
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-xl text-xs max-w-[85%]">
                {error}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form
          onSubmit={handleFormSubmit}
          className="border-t border-[#d1d7db] bg-[#F0F2F5] px-3 py-2.5 flex items-center gap-1.5"
        >
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#54656F] hover:bg-[#E9EDEF] transition"
            aria-label="Attach file"
          >
            <Paperclip size={19} />
          </button>

          <input
            ref={inputRef}
            type="text"
            placeholder={
              language === "ur"
                ? "اپنا سوال لکھیں / Sawal likhein..."
                : language === "en"
                ? "Type your message..."
                : "Type message in English or Urdu..."
            }
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isTyping}
            className="flex-1 rounded-lg bg-white border border-[#E9EDEF] outline-none px-3.5 py-2 text-sm text-[#111b21] placeholder:text-[#8696A0] focus:ring-1 focus:ring-[#075E54] disabled:opacity-50"
            autoComplete="off"
          />

          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#54656F] hover:bg-[#E9EDEF] transition hidden sm:flex"
            aria-label="Microphone"
          >
            <Mic size={19} />
          </button>

          <button
            type="button"
            onClick={handleLocationClick}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#54656F] hover:bg-[#E9EDEF] transition"
            aria-label="Share Location"
            title="Share Location"
          >
            <Smile size={19} />
          </button>

          <button
            type="submit"
            disabled={isTyping || !message.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#075E54] text-white hover:bg-[#128C7E] transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
