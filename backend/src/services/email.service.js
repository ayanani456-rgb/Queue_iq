// TODO: Integrate Nodemailer / SendGrid
async function sendEmail(to, subject, body) {
  console.log(`Email to ${to}: Subject ${subject}`);
  return true;
}

module.exports = { sendEmail };