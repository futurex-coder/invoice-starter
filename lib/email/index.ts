import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function sendInvitationEmail(to: string, teamName: string, role: string, inviteLink: string) {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject: `Join ${teamName} on Next.js SaaS Starter`,
    text: `You've been invited to join ${teamName} as a ${role}. Accept here: ${inviteLink}`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #f97316;">You're Invited!</h2>
        <p>You've been invited to join <strong>${teamName}</strong> as a <strong>${role}</strong>.</p>
        <p style="margin: 30px 0;">
          <a href="${inviteLink}" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Accept Invitation</a>
        </p>
        <p style="color: #666; font-size: 14px;">If you didn't expect this invitation, you can safely ignore this email.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error };
  }
}
