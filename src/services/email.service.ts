import nodemailer from "nodemailer";

function getMailerConfig() {
  const smtpHost = process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com";
  const smtpPort = Number(process.env.BREVO_SMTP_PORT || 587);
  const smtpUser = process.env.BREVO_SMTP_USER;
  const smtpPass = process.env.BREVO_SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    throw new Error("Missing Brevo SMTP environment variables");
  }

  return {
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
  };
}

export const sendResetOtpEmail = async (
  to: string,
  otp: string
): Promise<void> => {
  const { smtpHost, smtpPort, smtpUser, smtpPass } = getMailerConfig();

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: false,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const fromName = process.env.MAIL_FROM_NAME || "Bimo";
  const fromEmail = process.env.MAIL_FROM_EMAIL || "noreply@te-bot.site";
  const expiresMinutes = Number(process.env.OTP_EXPIRES_MINUTES || 10);

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject: "Bimo Password Reset Code",
    html: `
      <div style="margin:0;padding:24px;background:#f6f8fb;font-family:Arial,sans-serif;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:32px;">
          <h2 style="margin:0 0 16px;color:#111827;">Bimo Password Reset</h2>
          <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.8;">
            We received a request to reset your password.
          </p>
          <p style="margin:0 0 16px;color:#374151;font-size:15px;">
            Use this verification code:
          </p>
          <div style="text-align:center;background:#f3f4f6;border:1px dashed #d1d5db;border-radius:12px;padding:18px 20px;margin:20px 0;">
            <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#111827;">${otp}</span>
          </div>
          <p style="margin:0 0 8px;color:#374151;font-size:14px;">
            This code expires in ${expiresMinutes} minutes.
          </p>
          <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.8;">
            If you did not request this, you can safely ignore this email.
          </p>
        </div>
      </div>
    `,
  });
};