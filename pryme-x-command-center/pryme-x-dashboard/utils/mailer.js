const nodemailer = require('nodemailer');

function buildTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.warn('[Mailer] GMAIL_USER / GMAIL_APP_PASSWORD not set — invite emails will NOT be sent.');
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

const transporter = buildTransport();

/**
 * Sends the staff invitation email containing login credentials.
 */
async function sendInviteEmail({ to, username, tempPassword, jobPosition, accessLevel, loginUrl }) {
  if (!transporter) {
    throw new Error('Email transport not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD.');
  }

  const accessLabel = accessLevel === 'FULL' ? 'Full System Access' : 'Preview Only';

  const html = `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; background:#0b0b0d; padding:32px; color:#e9e6dd;">
    <div style="max-width:520px;margin:0 auto;background:#141416;border:1px solid #c9a44c55;border-radius:14px;overflow:hidden;">
      <div style="padding:28px 32px;background:linear-gradient(135deg,#1a1a1d,#0b0b0d);border-bottom:1px solid #c9a44c40;">
        <h1 style="margin:0;font-size:20px;letter-spacing:1px;color:#e6c667;">PRYME X <span style="color:#e9e6dd;">AI CYBER SOLUTIONS</span></h1>
        <p style="margin:6px 0 0;font-size:12px;color:#9a9690;letter-spacing:2px;">EXECUTIVE COMMAND CENTER</p>
      </div>
      <div style="padding:28px 32px;">
        <p style="font-size:15px;">You have been invited to join the Pryme X Command Center as <strong style="color:#e6c667;">${jobPosition}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr><td style="padding:8px 0;color:#9a9690;">Username</td><td style="padding:8px 0;font-weight:bold;">${username}</td></tr>
          <tr><td style="padding:8px 0;color:#9a9690;">Temporary Password</td><td style="padding:8px 0;font-weight:bold;">${tempPassword}</td></tr>
          <tr><td style="padding:8px 0;color:#9a9690;">Access Level</td><td style="padding:8px 0;font-weight:bold;color:#e6c667;">${accessLabel}</td></tr>
        </table>
        <p style="font-size:13px;color:#9a9690;">You will be required to set a new password on your first login.</p>
        <a href="${loginUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:linear-gradient(135deg,#e6c667,#c9a44c);color:#0b0b0d;border-radius:8px;text-decoration:none;font-weight:bold;">Access Command Center →</a>
      </div>
      <div style="padding:16px 32px;border-top:1px solid #c9a44c30;font-size:11px;color:#6b6862;">
        This is a confidential system invitation. Do not forward this email.
      </div>
    </div>
  </div>`;

  await transporter.sendMail({
    from: `"Pryme X AI Cyber Solutions" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Your Pryme X Command Center Access Credentials',
    html,
  });
}

module.exports = { sendInviteEmail };
