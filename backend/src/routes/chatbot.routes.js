const express = require("express");
const router = express.Router();
const { chat, getHospitals } = require("../controllers/chatbot.controller");

// Chat endpoint - no auth required for chatbot (open to users)
router.post("/chat", chat);

// Get hospitals data
router.get("/hospitals", getHospitals);

module.exports = router;
