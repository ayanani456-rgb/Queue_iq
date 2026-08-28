const { sendWhatsApp } = require('./whatsapp.service.js');
const { sendSMS } = require('./sms.service.js');
const { sendEmail } = require('./email.service.js');

async function sendNotification(user, message) {
  try {
    await sendWhatsApp(user.phone, message);
    await sendSMS(user.phone, message);
    if (user.email) await sendEmail(user.email, 'Queue Update', message);
    console.log('Notification sent to all channels');
    return true;
  } catch (error) {
    throw error;
  }
}

module.exports = { sendNotification };