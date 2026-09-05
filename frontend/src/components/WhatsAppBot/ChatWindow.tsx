"use client";

import { FormEvent, useState } from "react";
import { CheckCheck, Mic, Paperclip, Send, Smile } from "lucide-react";

type ChatMessage = {
  id: string | number;
  text: string;
  sender: "user" | "bot";
  time: string | Date;
  showPaymentButton?: boolean;
};

type ChatWindowProps = {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onPayment?: () => void;
  isTyping?: boolean;
};

export default function ChatWindow({
  messages,
  onSendMessage,
  onPayment,
  isTyping = false,
}: ChatWindowProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = message.trim();

    if (!text) return;

    onSendMessage(text);
    setMessage("");
  };

  const handleLocationClick = () => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(({ coords }) => {
      onSendMessage(`LOCATION:${coords.latitude},${coords.longitude}`);
    });
  };

  return (
    <section className="flex h-[600px] w-full max-w-md flex-col overflow-hidden rounded-xl bg-[#E5DDD5] shadow-lg">
      <header className="flex items-center gap-3 bg-[#075E54] px-4 py-3 text-white">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#128C7E] text-sm font-semibold">
          QA
        </div>
        <div>
          <h1 className="text-base font-semibold">QueueIQ AI Bot</h1>
          <p className="flex items-center gap-1.5 text-xs text-white/80">
            <span className="h-2 w-2 rounded-full bg-[#25D366]" aria-hidden="true" />
            Online
          </p>
        </div>
      </header>

      <div
        className="flex-1 space-y-2 overflow-y-auto bg-[#E5DDD5] p-3 sm:p-4"
        style={{
          backgroundImage: "radial-gradient(circle at 15% 20%, rgba(117, 96, 77, 0.08) 0 2px, transparent 2px), radial-gradient(circle at 80% 65%, rgba(117, 96, 77, 0.07) 0 1px, transparent 1px), linear-gradient(135deg, transparent 46%, rgba(117, 96, 77, 0.045) 47%, transparent 48%)",
          backgroundSize: "54px 54px, 72px 72px, 38px 38px",
        }}
        aria-live="polite"
      >
        {messages.map((item) => (
          <div
            key={item.id}
            className={`flex ${item.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`relative max-w-[85%] rounded-lg px-3 py-2 text-sm text-[#303030] shadow-sm before:absolute before:top-0 before:h-3 before:w-3 before:content-[''] ${
                item.sender === "user"
                  ? "rounded-tr-none bg-[#DCF8C6] before:-right-1.5 before:bg-[#DCF8C6] before:[clip-path:polygon(0_0,100%_0,0_100%)]"
                  : "rounded-tl-none bg-white before:-left-1.5 before:bg-white before:[clip-path:polygon(0_0,100%_0,100%_100%)]"
              } ${
                item.sender === "user" ? "bg-[#DCF8C6]" : "bg-white"
              }`}
            >
              <p className="break-words whitespace-pre-wrap">{item.text}</p>
              <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#667781]">
                {typeof item.time === "string" 
                  ? new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : item.time instanceof Date 
                  ? item.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "12:14 PM"}
                {item.sender === "bot" ? <CheckCheck size={14} className="text-[#53BDEB]" aria-label="Read" /> : null}
              </p>
              {item.showPaymentButton ? (
                <button
                  type="button"
                  onClick={onPayment}
                  className="mt-2 w-full rounded-md bg-[#25D366] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#20BD5A]"
                >
                  Pay Now
                </button>
              ) : null}
            </div>
          </div>
        ))}

        {isTyping ? (
          <div className="flex justify-start" aria-label="Bot is typing">
            <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs text-[#667781] shadow-sm">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#667781] [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#667781] [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#667781]" />
              <span>typing...</span>
            </div>
          </div>
        ) : null}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-1.5 bg-[#F0F2F5] p-2.5"
      >
        <button
          type="button"
          aria-label="Add emoji"
          title="Add emoji"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#54656F] transition hover:bg-[#E1E5E8]"
        >
          <Smile size={21} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleLocationClick}
          aria-label="Share location"
          title="Share location"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#54656F] transition hover:bg-[#E1E5E8]"
        >
          <Paperclip size={20} aria-hidden="true" />
        </button>
        <input
          type="text"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Type a message"
          aria-label="Message"
          className="min-w-0 flex-1 rounded-full border border-transparent bg-white px-4 py-2.5 text-sm text-[#303030] outline-none placeholder:text-[#667781] focus:border-[#25D366]"
        />
        <button
          type="submit"
          aria-label="Send message"
          title="Send message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white transition hover:bg-[#20BD5A] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!message.trim()}
        >
          {message.trim() ? <Send size={18} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
        </button>
      </form>
    </section>
  );
}
