const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendChurnEmail(userID, clientID, churnScore) {
  const mailOptions = {
    from: `"ChurnOpp Alerts" <${process.env.EMAIL_USER}>`,
    to: 'your-email@example.com', // Replace with client/admin's email dynamically later
    subject: `⚠️ Churn Risk Alert - User ${userID}`,
    html: `
      <h2>High Churn Risk Detected</h2>
      <p>User <strong>${userID}</strong> (Client ID: ${clientID}) has a churn score of <strong>${churnScore}</strong>.</p>
      <p>Consider reaching out or sending a re-engagement deal.</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Churn alert sent for ${userID}`);
  } catch (err) {
    console.error(`❌ Email failed for ${userID}:`, err);
  }
}

module.exports = sendChurnEmail;
