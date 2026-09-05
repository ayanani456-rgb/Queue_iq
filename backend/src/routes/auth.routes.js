// -----------------------------------------------------------------------------
// Auth routes — mounted at "/api/auth" in app.js:
//   POST /api/auth/login   -> verify staff credentials, return a JWT
// -----------------------------------------------------------------------------
const express = require('express');

const router = express.Router();
const { login } = require('../controllers/auth.controller');

router.post('/login', login);

module.exports = router;
