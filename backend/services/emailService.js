import tls from 'tls';
import net from 'net';

const getEmailConfig = () => {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const port = Number(process.env.SMTP_PORT || 587);
  const gmailClientId = process.env.GMAIL_CLIENT_ID;
  const gmailClientSecret = process.env.GMAIL_CLIENT_SECRET;
  const gmailRefreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const gmailSender = process.env.GMAIL_SENDER || process.env.GMAIL_USER;
  const brevoApiKey = process.env.BREVO_API_KEY;
  const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL || process.env.GMAIL_USER;
  const brevoSenderName = process.env.BREVO_SENDER_NAME || 'BIDPal';
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM || process.env.EMAIL_FROM || 'BIDPal <onboarding@resend.dev>';

  return {
    gmailClientId,
    gmailClientSecret,
    gmailRefreshToken,
    gmailSender,
    brevoApiKey,
    brevoSenderEmail,
    brevoSenderName,
    resendApiKey,
    resendFrom,
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === 'true'
      : port === 465,
    user,
    pass,
    from: process.env.SMTP_FROM || user,
  };
};

export const getEmailServiceStatus = () => {
  const config = getEmailConfig();
  const hasGmailApi = Boolean(config.gmailClientId && config.gmailClientSecret && config.gmailRefreshToken && config.gmailSender);
  const hasBrevoApi = Boolean(config.brevoApiKey && config.brevoSenderEmail);
  const provider = hasBrevoApi
    ? 'brevo'
    : hasGmailApi
      ? 'gmail-api'
      : config.resendApiKey
        ? 'resend'
        : process.env.SMTP_HOST
          ? 'custom-smtp'
          : 'gmail';

  return {
    configured: Boolean(hasBrevoApi || hasGmailApi || config.resendApiKey || (config.user && config.pass && config.from)),
    provider,
    smtpPort: config.port,
    smtpSecure: String(config.secure),
    hasUser: Boolean(config.user),
    hasPassword: Boolean(config.pass),
    hasBrevoApiKey: Boolean(config.brevoApiKey),
    hasGmailClient: Boolean(config.gmailClientId && config.gmailClientSecret),
    hasGmailRefreshToken: Boolean(config.gmailRefreshToken),
    hasResendApiKey: Boolean(config.resendApiKey),
    from: provider === 'brevo'
      ? config.brevoSenderEmail
      : provider === 'gmail-api'
        ? config.gmailSender
        : provider === 'resend'
          ? config.resendFrom
          : config.from,
  };
};

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

const toBase64Url = (value) => Buffer.from(value)
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/g, '');

const getGmailAccessToken = async (config) => {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.gmailClientId,
      client_secret: config.gmailClientSecret,
      refresh_token: config.gmailRefreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (res.ok && data.access_token) return data.access_token;

  const err = new Error(data.error_description || data.error || 'Unable to get Gmail API access token.');
  err.code = 'EMAIL_AUTH_FAILED';
  throw err;
};

const sendWithGmailApi = async ({ config, to, subject, text, html, replyTo }) => {
  const accessToken = await getGmailAccessToken(config);
  const message = [
    `From: BIDPal <${escapeHeader(config.gmailSender)}>`,
    `To: ${escapeHeader(to)}`,
    ...(replyTo ? [`Reply-To: ${escapeHeader(replyTo)}`] : []),
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

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: toBase64Url(message) }),
  });

  if (res.ok) return;

  const data = await res.json().catch(() => ({}));
  const err = new Error(data.error?.message || 'Gmail API could not send this email.');
  err.code = res.status === 401 || res.status === 403 ? 'EMAIL_AUTH_FAILED' : 'EMAIL_API_FAILED';
  throw err;
};

const sendWithBrevoApi = async ({ config, to, subject, text, html, replyTo }) => {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': config.brevoApiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: config.brevoSenderName,
        email: config.brevoSenderEmail,
      },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html || text,
      ...(replyTo ? { replyTo: { email: replyTo } } : {}),
    }),
  });

  if (res.ok) {
    const data = await res.json().catch(() => ({}));
    if (process.env.NODE_ENV !== 'production' && data.messageId) {
      console.log(`Brevo email queued: ${data.messageId}`);
    }
    return;
  }

  const data = await res.json().catch(() => ({}));
  const err = new Error(data.message || data.error || 'Brevo could not send this email.');
  err.code = res.status === 401 || res.status === 403 ? 'EMAIL_AUTH_FAILED' : 'EMAIL_API_FAILED';
  throw err;
};

const connectSecure = ({ host, port }) => new Promise((resolve, reject) => {
  const socket = tls.connect(port, host, { servername: host }, () => resolve(socket));
  socket.setTimeout(12000, () => socket.destroy(new Error('SMTP connection timed out.')));
  socket.once('error', reject);
});

const connectStartTls = async ({ host, port }) => {
  const rawSocket = await new Promise((resolve, reject) => {
    const socket = net.connect(port, host, () => resolve(socket));
    socket.setTimeout(12000, () => socket.destroy(new Error('SMTP connection timed out.')));
    socket.once('error', reject);
  });

  await readResponse(rawSocket);
  await writeCommand(rawSocket, `EHLO ${host}`);
  await writeCommand(rawSocket, 'STARTTLS');

  return new Promise((resolve, reject) => {
    const secureSocket = tls.connect({ socket: rawSocket, servername: host }, () => resolve(secureSocket));
    secureSocket.setTimeout(12000, () => secureSocket.destroy(new Error('SMTP connection timed out.')));
    secureSocket.once('error', reject);
  });
};

const getDeliveryConfigs = (config) => {
  const configs = [config];
  const isGmail = config.host === 'smtp.gmail.com';
  const alternatePort = config.secure ? 587 : 465;

  if (isGmail && config.port !== alternatePort) {
    configs.push({
      ...config,
      port: alternatePort,
      secure: alternatePort === 465,
    });
  }

  if (isGmail) {
    const baseConfigs = [...configs];
    for (const baseConfig of baseConfigs) {
      configs.push({
        ...baseConfig,
        host: 'smtp.googlemail.com',
      });
    }
  }

  return configs;
};

export const isEmailConfigured = () => {
  return getEmailServiceStatus().configured;
};

export const sendEmail = async ({ to, subject, text, html, replyTo }) => {
  const config = getEmailConfig();
  const hasBrevoApi = config.brevoApiKey && config.brevoSenderEmail;
  const hasGmailApi = config.gmailClientId && config.gmailClientSecret && config.gmailRefreshToken && config.gmailSender;

  if (hasBrevoApi) {
    return sendWithBrevoApi({ config, to, subject, text, html, replyTo });
  }

  if (hasGmailApi) {
    return sendWithGmailApi({ config, to, subject, text, html, replyTo });
  }

  if (config.resendApiKey) {
    const res = await fetch('https://api.resend.com/emails', {
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
  }

  if (!config.user || !config.pass || !config.from) {
    const err = new Error('Email service is not configured. Set RESEND_API_KEY for deployed email, or set SMTP_USER and SMTP_PASS / GMAIL_USER and GMAIL_APP_PASSWORD.');
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }

  const headers = [
    `From: BIDPal <${escapeHeader(config.from)}>`,
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

  let lastError;

  for (const deliveryConfig of getDeliveryConfigs(config)) {
    let socket;
    try {
      socket = deliveryConfig.secure
        ? await connectSecure(deliveryConfig)
        : await connectStartTls(deliveryConfig);

      if (deliveryConfig.secure) await readResponse(socket);
      await writeCommand(socket, `EHLO ${deliveryConfig.host}`);
      await writeCommand(socket, 'AUTH LOGIN');
      await writeCommand(socket, Buffer.from(deliveryConfig.user).toString('base64'));
      try {
        await writeCommand(socket, Buffer.from(deliveryConfig.pass).toString('base64'));
      } catch (err) {
        const authError = new Error('Gmail rejected the sender credentials. Use a Gmail App Password for the BIDPal sender account.');
        authError.code = 'EMAIL_AUTH_FAILED';
        authError.cause = err;
        throw authError;
      }
      await writeCommand(socket, `MAIL FROM:<${deliveryConfig.from}>`);
      await writeCommand(socket, `RCPT TO:<${to}>`);
      await writeCommand(socket, 'DATA');
      socket.write(`${message}\r\n.\r\n`);
      await readResponse(socket);
      await writeCommand(socket, 'QUIT');
      return;
    } catch (err) {
      lastError = err;
      if (err.code === 'EMAIL_AUTH_FAILED') throw err;
    } finally {
      if (socket) socket.end();
    }
  }

  const deliveryError = new Error('Unable to connect to Gmail SMTP from the deployed server.');
  deliveryError.code = 'EMAIL_DELIVERY_FAILED';
  deliveryError.cause = lastError;
  throw deliveryError;
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
