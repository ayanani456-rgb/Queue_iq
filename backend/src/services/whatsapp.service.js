// TODO: Integrate a real WhatsApp API later.
async function sendWhatsApp(phone, message) {
  console.log(`Sending to ${phone}: ${message}`);
  return true;
}

module.exports = { sendWhatsApp };