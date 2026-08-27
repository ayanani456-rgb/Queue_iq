// TODO: Integrate a real WhatsApp API later.
async function sendWhatsApp(phone, message) {
  console.log(`Sending to ${phone}: ${message}`);
  return true;
}

async function testWhatsApp() {
  const result = await sendWhatsApp('YOUR_PHONE_NUMBER', 'Test from Queue_iQ');
  console.log(result);
  return result;
}

module.exports = { sendWhatsApp, testWhatsApp };