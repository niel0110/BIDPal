const getEmailConfig = () => {
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM || process.env.EMAIL_FROM || 'BIDPal <onboarding@resend.dev>';

  return {
    resendApiKey,
    resendFrom,
  };
};

export const getEmailServiceStatus = () => {
  const config = getEmailConfig();

  return {
    configured: Boolean(config.resendApiKey),
    provider: 'resend',
    hasResendApiKey: Boolean(config.resendApiKey),
    from: config.resendFrom,
  };
};

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export const isEmailConfigured = () => {
  return getEmailServiceStatus().configured;
};

export const sendEmail = async ({ to, subject, text, html, replyTo }) => {
  const config = getEmailConfig();

  if (!config.resendApiKey) {
    const err = new Error('Email service is not configured. Set RESEND_API_KEY and RESEND_FROM.');
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }

  let res;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.resendFrom,
        to: [to],
        subject,
        text,
        html: html || text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
  } catch (cause) {
    const err = new Error('Unable to reach Resend email API.');
    err.code = 'EMAIL_API_FAILED';
    err.cause = cause;
    throw err;
  }

  if (res.ok) return;

  let details = '';
  try {
    const data = await res.json();
    details = data?.message || data?.error?.message || JSON.stringify(data);
  } catch {
    details = await res.text();
  }

  const err = new Error(details || `Resend email API failed with status ${res.status}.`);
  err.code = res.status === 401 || res.status === 403 ? 'EMAIL_AUTH_FAILED' : 'EMAIL_API_FAILED';
  throw err;
};

export const sendSupportInquiryEmail = ({ supportEmail, userEmail, userName, category, subject, message, referenceId }) => {
  const submittedAt = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
  const lines = [
    `A BIDPal support inquiry was submitted.`,
    ``,
    `From: ${userName || 'BIDPal User'} <${userEmail}>`,
    `Category: ${category}`,
    referenceId ? `Reference ID: ${referenceId}` : null,
    `Submitted: ${submittedAt}`,
    ``,
    `Subject: ${subject}`,
    ``,
    message,
  ].filter(Boolean);

  return sendEmail({
    to: supportEmail,
    replyTo: userEmail,
    subject: `[BIDPal Support] ${subject}`,
    text: lines.join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <h2 style="color: #d02440; margin-bottom: 8px;">New BIDPal Support Inquiry</h2>
        <p><strong>From:</strong> ${escapeHtml(userName || 'BIDPal User')} &lt;${escapeHtml(userEmail)}&gt;</p>
        <p><strong>Category:</strong> ${escapeHtml(category)}</p>
        ${referenceId ? `<p><strong>Reference ID:</strong> ${escapeHtml(referenceId)}</p>` : ''}
        <p><strong>Submitted:</strong> ${escapeHtml(submittedAt)}</p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
      </div>
    `,
  });
};

export const sendSupportReceiptEmail = ({ userEmail, userName, subject }) => {
  return sendEmail({
    to: userEmail,
    subject: 'We received your BIDPal support inquiry',
    text: `Hi ${userName || 'there'},\n\nWe received your support inquiry: "${subject}". Our support team will review it and reply through email.\n\nThank you,\nBIDPal Support`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <h2 style="color: #d02440; margin-bottom: 8px;">We received your inquiry</h2>
        <p>Hi ${escapeHtml(userName || 'there')},</p>
        <p>We received your support inquiry: <strong>${escapeHtml(subject)}</strong>.</p>
        <p>Our support team will review it and reply through email.</p>
        <p>Thank you,<br />BIDPal Support</p>
      </div>
    `,
  });
};

export const sendVerificationCodeEmail = ({ email, code, purpose }) => {
  const isReset = purpose === 'forgot-password';
  const subject = isReset ? 'Reset your BIDPal password' : 'Verify your BIDPal email';
  const intro = isReset
    ? 'Use this code to reset your BIDPal password.'
    : 'Use this code to verify your email and finish creating your BIDPal account.';

  return sendEmail({
    to: email,
    subject,
    text: `${intro}\n\nYour verification code is ${code}.\n\nThis code expires in 10 minutes. If you did not request it, you can ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <h2 style="color: #d02440; margin-bottom: 8px;">${subject}</h2>
        <p>${intro}</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #111827; margin: 20px 0;">${code}</p>
        <p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
      </div>
    `,
  });
};
