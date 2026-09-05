const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://queueiq-backend-production.up.railway.app";

export const whatsappService = {
  async sendMessage(phone: string, message: string) {
    try {
      const response = await fetch(`${API_BASE}/api/whatsapp/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone, message }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      console.error("Failed to send WhatsApp message:", error);
      throw error;
    }
  },

  async getQueueStatus(doctorId: string) {
    try {
      const response = await fetch(
        `${API_BASE}/api/business/tokens?doctorId=${doctorId}`,
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch queue status: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      console.error("Failed to fetch queue status:", error);
      throw error;
    }
  },

  async bookToken(doctorId: string, phone: string, type: string) {
    try {
      const response = await fetch(`${API_BASE}/api/tokens/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          doctor_id: doctorId, 
          phone, 
          tokenType: type 
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to book token: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      console.error("Failed to book token:", error);
      throw error;
    }
  },
};
