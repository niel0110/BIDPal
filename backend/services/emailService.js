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

export const isEmailConfigured = () => Boolean(SMTP_USER && SMTP_PASS && SMTP_FROM);

export const sendEmail = async ({ to, subject, text, html }) => {
  if (!isEmailConfigured()) {
    const err = new Error('Email service is not configured. Set SMTP_USER and SMTP_PASS, or GMAIL_USER and GMAIL_APP_PASSWORD.');
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }

  const message = [
    `From: BIDPal <${escapeHeader(SMTP_FROM)}>`,
    `To: ${escapeHeader(to)}`,
    `Subject: ${escapeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="bidpal-boundary"',
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
