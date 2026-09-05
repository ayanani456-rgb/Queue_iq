export type ChatMessage = {
  id: string | number;
  text: string;
  sender: "user" | "bot";
  time: Date;
};

export type ChatHistory = {
  role: string;
  content: string;
}[];

export const groqService = {
  async sendMessage(
    userMessage: string,
    chatHistory: ChatHistory,
    userLocation: { lat: number; lng: number } | null = null
  ): Promise<string> {
    try {
      const response = await fetch("/api/groq", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          language: "en",
          history: chatHistory.slice(-8),
          userLocation,
          hospitalsData: [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return (
        data.reply ||
        "Sorry, I couldn't generate a response. Please try again."
      );
    } catch (error) {
      console.error("Groq service error:", error);
      throw error;
    }
  },
};
