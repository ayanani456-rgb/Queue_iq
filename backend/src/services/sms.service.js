// TODO: Integrate Twilio / Fast2SMS API
async function sendSMS(phone, message) {
  console.log(`SMS to ${phone}: ${message}`);
  return true;
}

module.exports = { sendSMS };