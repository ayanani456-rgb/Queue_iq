"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { Send, CheckCheck, X, MessageCircle, Mic, Paperclip } from "lucide-react";

export type ChatMessage = {
  id: string | number;
  role: "user" | "assistant";
  content: string;
  sender?: "user" | "bot";
  text?: string;
  time?: Date | string;
};

type ChatWidgetProps = {
  isOpen?: boolean;
  onClose?: () => void;
};

export default function ChatWidget({ isOpen: propIsOpen, onClose }: ChatWidgetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = propIsOpen !== undefined ? propIsOpen : internalOpen;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "assistant",
      content: "Assalamualaikum! Welcome to QueueIQ (Al Shifa Clinic). How can I assist you with your appointment or token today?",
      sender: "bot",
      text: "Assalamualaikum! Welcome to QueueIQ (Al Shifa Clinic). How can I assist you with your appointment or token today?",
      time: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, messages, isLoading]);

  const handleSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const userText = input.trim();
    if (!userText || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: userText,
      sender: "user",
      text: userText,
      time: new Date(),
    };

    // Construct full messages array state including the new message
    const updatedMessages: ChatMessage[] = [...messages, userMessage];

    // Log full array of messages in console - Array(N)
    console.log("ChatWidget sending messages:", updatedMessages);

    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      // Send full messages array state to /api/chat
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role || (m.sender === "user" ? "user" : "assistant"),
            content: m.content || m.text || "",
          })),
        }),
      });

      const data = await response.json();
      const botReply = data.reply || "Salam! Kaise madad kar sakta hoon?";

      const botMessage: ChatMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: botReply,
        sender: "bot",
        text: botReply,
        time: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      console.error("Chat error:", err);
      const errorMessage: ChatMessage = {
        id: Date.now() + 2,
        role: "assistant",
        content: "Network issue, please try again! / معافی چاہتا ہوں، نیٹ ورک میں مسئلہ آیا۔",
        sender: "bot",
        text: "Network issue, please try again! / معافی چاہتا ہوں، نیٹ ورک میں مسئلہ آیا۔",
        time: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setInternalOpen(false);
    }
  };

  return (
    <>
      {!isOpen && propIsOpen === undefined && (
        <button
          onClick={() => setInternalOpen(true)}
          className="fixed bottom-6 right-6 z-[9999] flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105 hover:bg-[#128C7E]"
          aria-label="Open Chat"
        >
          <MessageCircle className="h-7 w-7" />
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-[10000] flex items-end justify-end bg-black/40 p-2 sm:p-4 md:items-center md:justify-center backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
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
                  <h1 className="text-base font-semibold leading-tight">QueueIQ AI &bull; Al Shifa</h1>
                  <p className="flex items-center gap-1.5 text-xs text-emerald-200">
                    <span className="h-2 w-2 rounded-full bg-[#25D366] animate-pulse" />
                    Online
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/90 transition hover:bg-white/15 hover:text-white"
                aria-label="Close chat"
              >
                <X size={20} />
              </button>
            </header>

            {/* Messages Area */}
            <div
              className="flex h-[380px] sm:h-[420px] flex-col space-y-3 overflow-y-auto bg-[#E5DDD5] p-3 sm:p-4"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 15% 20%, rgba(117, 96, 77, 0.08) 0 2px, transparent 2px), radial-gradient(circle at 80% 65%, rgba(117, 96, 77, 0.07) 0 1px, transparent 1px), linear-gradient(135deg, transparent 46%, rgba(117, 96, 77, 0.045) 47%, transparent 48%)",
                backgroundSize: "54px 54px, 72px 72px, 38px 38px",
              }}
            >
              {messages.map((item) => (
                <div
                  key={item.id}
                  className={`flex flex-col ${
                    item.role === "user" || item.sender === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`relative max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm text-[#111b21] shadow-sm ${
                      item.role === "user" || item.sender === "user"
                        ? "rounded-tr-none bg-[#DCF8C6]"
                        : "rounded-tl-none bg-white"
                    }`}
                  >
                    <p className="break-words whitespace-pre-wrap leading-relaxed">{item.content || item.text}</p>
                    <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#667781]">
                      {typeof item.time === "object" && item.time instanceof Date
                        ? item.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "Now"}
                      {item.role === "assistant" || item.sender === "bot" ? (
                        <CheckCheck size={14} className="text-[#53BDEB]" />
                      ) : null}
                    </p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-none bg-white px-3.5 py-2 text-xs text-[#667781] shadow-sm">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#128C7E] [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#128C7E] [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#128C7E]" />
                    <span className="text-[11px] text-[#667781] ml-1">QueueIQ AI is typing...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={handleSendMessage}
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
                placeholder="Type your message in English or Urdu..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
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
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#075E54] text-white hover:bg-[#128C7E] transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
