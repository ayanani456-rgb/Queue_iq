const { sendChatMessage, HOSPITALS_DATA } = require("../services/groq-chat.service");

async function chat(req, res) {
  try {
    const { message, language = "en", history = [] } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (language && !["en", "ur"].includes(language)) {
      return res.status(400).json({ error: "Language must be 'en' or 'ur'" });
    }

    // Send message to Groq AI with fallback handling
    let reply;
    try {
      reply = await sendChatMessage(message, history, language);
    } catch (error) {
      console.error("Groq API error:", error.message);
      // Send error message to user in their language
      if (language === "ur") {
        reply = "معافی چاہتا ہوں، کوئی تکنیکی خرابی پیش آئی۔ براہ کرم دوبارہ کوشش کریں۔";
      } else {
        reply = "Sorry, there was a technical error. Please try again.";
      }
    }

    res.json({
      reply,
      language,
      hospitalsData: HOSPITALS_DATA,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({
      error: error.message || "Failed to process chat message",
    });
  }
}

async function getHospitals(req, res) {
  try {
    res.json(HOSPITALS_DATA);
  } catch (error) {
    console.error("Get hospitals error:", error);
    res.status(500).json({ error: "Failed to fetch hospitals" });
  }
}

module.exports = {
  chat,
  getHospitals,
};
