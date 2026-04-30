import tls from 'tls';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || process.env.GMAIL_USER;
const SMTP_PASS = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

const readResponse = (socket) => new Promise((resolve, reject) => {
  let buffer = '';
  const onData = (chunk) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.trimEnd().split(/\r?\n/);
    const last = lines[lines.length - 1] || '';
    if (/^\d{3} /.test(last)) {
      socket.off('data', onData);
      const code = Number(last.slice(0, 3));
      if (code >= 400) reject(new Error(buffer.trim()));
      else resolve(buffer.trim());
    }
  };
  socket.on('data', onData);
  socket.once('error', reject);
});

const writeCommand = async (socket, command) => {
  socket.write(`${command}\r\n`);
  return readResponse(socket);
};

const escapeHeader = (value) => String(value || '').replace(/[\r\n]+/g, ' ').trim();
const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export const isEmailConfigured = () => Boolean(SMTP_USER && SMTP_PASS && SMTP_FROM);

export const sendEmail = async ({ to, subject, text, html, replyTo }) => {
  if (!isEmailConfigured()) {
    const err = new Error('Email service is not configured. Set SMTP_USER and SMTP_PASS, or GMAIL_USER and GMAIL_APP_PASSWORD.');
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }

  const headers = [
    `From: BIDPal <${escapeHeader(SMTP_FROM)}>`,
    `To: ${escapeHeader(to)}`,
    ...(replyTo ? [`Reply-To: ${escapeHeader(replyTo)}`] : []),
    `Subject: ${escapeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="bidpal-boundary"',
  ];

  const message = [
    ...headers,
    '',
    '--bidpal-boundary',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    text,
    '',
    '--bidpal-boundary',
    'Content-Type: text/html; charset="UTF-8"',
    '',
    html || text,
    '',
    '--bidpal-boundary--',
    '',
  ].join('\r\n');

  const socket = tls.connect(SMTP_PORT, SMTP_HOST, { servername: SMTP_HOST });

  try {
    await readResponse(socket);
    await writeCommand(socket, `EHLO ${SMTP_HOST}`);
    await writeCommand(socket, 'AUTH LOGIN');
    await writeCommand(socket, Buffer.from(SMTP_USER).toString('base64'));
    try {
      await writeCommand(socket, Buffer.from(SMTP_PASS).toString('base64'));
    } catch (err) {
      const authError = new Error('Gmail rejected the sender credentials. Use a Gmail App Password for the BIDPal sender account.');
      authError.code = 'EMAIL_AUTH_FAILED';
      authError.cause = err;
      throw authError;
    }
    await writeCommand(socket, `MAIL FROM:<${SMTP_FROM}>`);
    await writeCommand(socket, `RCPT TO:<${to}>`);
    await writeCommand(socket, 'DATA');
    socket.write(`${message}\r\n.\r\n`);
    await readResponse(socket);
    await writeCommand(socket, 'QUIT');
  } finally {
    socket.end();
  }
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
