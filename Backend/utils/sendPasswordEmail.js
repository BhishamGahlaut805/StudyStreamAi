const nodemailer = require("nodemailer");

async function sendPasswordEmail(email, password) {
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"StudyStream" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your New Password",
    html: `
      <div style="font-family:sans-serif; padding:20px; max-width:600px; margin:auto; border:1px solid #ccc; border-radius:10px;">
        <h2 style="color:#2d6cdf;">Hi User,</h2>
        <p>Your new StudyStream password has been generated:</p>
        <p style="background:#f0f0f0; padding:10px; border-radius:6px;"><code>${password}</code></p>
        <p>Please log in and update your password from your profile settings.</p>
        <a href="http://localhost:5173/login" style="display:inline-block;margin-top:10px;padding:10px 15px;background:#2d6cdf;color:white;border-radius:6px;text-decoration:none;">Log In</a>
      </div>
    `,
  });
}

module.exports = sendPasswordEmail;
