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

      return response.json();
    } catch (error) {
      console.error("Failed to send WhatsApp message:", error);
      throw error;
    }
  },

  async getLiveDoctors(hospital?: string, speciality?: string) {
    try {
      const response = await fetch(
        `${API_BASE}/api/doctors?hospital=${hospital}&speciality=${speciality}`,
      );

      return response.json();
    } catch (error) {
      console.error("Failed to fetch live doctors:", error);
      throw error;
    }
  },

  async getQueueStatus(doctorId: string) {
    try {
      const response = await fetch(
        `${API_BASE}/api/queue/status?doctorId=${doctorId}`,
      );

      return response.json();
    } catch (error) {
      console.error("Failed to fetch queue status:", error);
      throw error;
    }
  },

  async generateToken(doctorId: string, phone: string, type: string) {
    try {
      const response = await fetch(`${API_BASE}/api/tokens/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ doctorId, phone, type }),
      });

      return response.json();
    } catch (error) {
      console.error("Failed to generate token:", error);
      throw error;
    }
  },
};
