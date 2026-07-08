import nodemailer from 'nodemailer';
import { logger } from '@/lib/logger';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function sendInvitationEmail(to: string, companyName: string, role: string, inviteLink: string) {
  const roleLabels: Record<string, string> = {
    owner: 'собственик',
    accountant: 'счетоводител',
  };
  const roleLabel = roleLabels[role] ?? role;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject: `Покана да се присъедините към ${companyName} в Invoicly`,
    text: `Поканени сте да се присъедините към ${companyName} като ${roleLabel}. Приемете тук: ${inviteLink}`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #f97316;">Поканени сте!</h2>
        <p>Поканени сте да се присъедините към <strong>${companyName}</strong> като <strong>${roleLabel}</strong>.</p>
        <p style="margin: 30px 0;">
          <a href="${inviteLink}" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Приемете поканата</a>
        </p>
        <p style="color: #666; font-size: 14px;">Ако не очаквахте тази покана, можете спокойно да пренебрегнете този имейл.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.warn('Email sent', { messageId: info.messageId });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Error sending email', { err: error });
    return { success: false, error };
  }
}
