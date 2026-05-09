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

export const escapeHtml = (value) => String(value || '')
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

const formatDateTime = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const accountStandingEmailContent = ({ userName, standing, reason, suspensionExpiresAt, adminNotes }) => {
  const name = userName || 'there';
  const reviewedAt = formatDateTime(new Date());
  const suspensionEnd = formatDateTime(suspensionExpiresAt);
  const normalizedReason = String(reason || adminNotes || '').trim();

  const content = {
    Active: {
      subject: 'Your BIDPal account has been reactivated',
      heading: 'Your BIDPal account is active again',
      summary: 'Your BIDPal account has been restored to Active status. You can sign in and use BIDPal again.',
      status: 'Active',
      impact: [
        'You can sign in to your BIDPal account.',
        'Your bidding, buying, messaging, and account features are available again, subject to normal platform rules.',
        'Any previous temporary access restriction tied to this review has been lifted.',
      ],
      nextSteps: [
        'Sign in to your account and review your profile, orders, bids, and notifications.',
        'Continue following BIDPal policies for payments, bidding, messaging, and transactions.',
        'Contact BIDPal Support if something still appears restricted after you sign in.',
      ],
    },
    Probationary: {
      subject: 'Important notice: your BIDPal account is on probation',
      heading: 'Your account has been placed on probation',
      summary: 'Your BIDPal account remains open, but it is now under probationary review because of account activity that requires attention.',
      status: 'Probationary',
      impact: [
        'You may continue using BIDPal, but your account activity may be monitored more closely.',
        'Further policy violations may lead to temporary suspension or permanent blacklisting.',
        'Some actions may receive additional review if they create payment, bidding, or marketplace safety concerns.',
      ],
      nextSteps: [
        'Review the reason below and correct the behavior immediately.',
        'Complete payments and order responsibilities on time.',
        'Avoid bogus bidding, joy reserving, abusive messaging, or any activity that violates BIDPal rules.',
      ],
    },
    Suspended: {
      subject: 'Your BIDPal account has been suspended',
      heading: 'Your account has been temporarily suspended',
      summary: 'Your BIDPal account has been temporarily suspended after an account review.',
      status: 'Suspended',
      impact: [
        'You may be blocked from bidding, buying, selling, messaging, or accessing parts of BIDPal while the suspension is active.',
        suspensionEnd ? `The suspension is scheduled to end on ${suspensionEnd}.` : 'The suspension period is pending further review.',
        'Additional violations during or after the suspension may result in permanent blacklisting.',
      ],
      nextSteps: [
        'Read the reason below and wait until the suspension period ends before attempting restricted actions.',
        'Resolve any pending payments, orders, disputes, or support requests if BIDPal Support asks you to do so.',
        'Contact BIDPal Support if you believe this action was made in error.',
      ],
    },
    Blacklisted: {
      subject: 'Your BIDPal account has been permanently blacklisted',
      heading: 'Your account has been blacklisted',
      summary: 'Your BIDPal account has been permanently blacklisted after an account review.',
      status: 'Blacklisted',
      impact: [
        'You can no longer sign in to this BIDPal account.',
        'Your access to bidding, buying, selling, messaging, and other BIDPal features has been revoked.',
        'Creating another account to bypass this action may result in further enforcement.',
      ],
      nextSteps: [
        'If you believe this was a mistake, submit a reactivation appeal from the BIDPal reactivation page.',
        'Include your registered email address, a valid ID document, and a clear explanation of your appeal.',
        'BIDPal will review the request and contact you through your registered email address.',
      ],
    },
    ReactivationRejected: {
      subject: 'Your BIDPal reactivation request was not approved',
      heading: 'Your reactivation request was denied',
      summary: 'BIDPal reviewed your reactivation request and did not approve account reactivation at this time.',
      status: 'Blacklisted',
      impact: [
        'Your account remains blacklisted.',
        'You cannot sign in or use BIDPal account features with this account.',
        'The decision was based on the reactivation review and available account information.',
      ],
      nextSteps: [
        'Review the notes below, if provided.',
        'Do not create a new account to bypass the blacklist.',
        'Contact BIDPal Support only if you have new information that was not included in your appeal.',
      ],
    },
  };

  const selected = content[standing] || content.Active;
  return {
    ...selected,
    name,
    reviewedAt,
    reason: normalizedReason,
    suspensionEnd,
  };
};

export const sendAccountStandingEmail = async ({
  email,
  userName,
  standing,
  reason,
  suspensionExpiresAt,
  adminNotes,
}) => {
  const content = accountStandingEmailContent({
    userName,
    standing,
    reason,
    suspensionExpiresAt,
    adminNotes,
  });

  const reasonText = content.reason || 'No additional note was provided.';
  const lines = [
    `Hi ${content.name},`,
    ``,
    content.summary,
    ``,
    `Account status: ${content.status}`,
    `Reviewed: ${content.reviewedAt}`,
    content.suspensionEnd ? `Suspension end: ${content.suspensionEnd}` : null,
    `Reason / notes: ${reasonText}`,
    ``,
    `What this means:`,
    ...content.impact.map(item => `- ${item}`),
    ``,
    `What you should do next:`,
    ...content.nextSteps.map(item => `- ${item}`),
    ``,
    `If you believe this action was made in error, contact BIDPal Support and include your registered email address plus any related order, bid, or case details.`,
    ``,
    `Thank you,`,
    `BIDPal Account Safety Team`,
  ].filter(Boolean);

  return sendEmail({
    to: email,
    subject: content.subject,
    text: lines.join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 680px;">
        <h2 style="color: #d02440; margin-bottom: 8px;">${escapeHtml(content.heading)}</h2>
        <p>Hi ${escapeHtml(content.name)},</p>
        <p>${escapeHtml(content.summary)}</p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 8px;"><strong>Account status:</strong> ${escapeHtml(content.status)}</p>
          <p style="margin: 0 0 8px;"><strong>Reviewed:</strong> ${escapeHtml(content.reviewedAt)}</p>
          ${content.suspensionEnd ? `<p style="margin: 0 0 8px;"><strong>Suspension end:</strong> ${escapeHtml(content.suspensionEnd)}</p>` : ''}
          <p style="margin: 0;"><strong>Reason / notes:</strong> ${escapeHtml(reasonText)}</p>
        </div>
        <h3 style="font-size: 16px; margin-bottom: 8px;">What this means</h3>
        <ul>${content.impact.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        <h3 style="font-size: 16px; margin-bottom: 8px;">What you should do next</h3>
        <ul>${content.nextSteps.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        <p>If you believe this action was made in error, contact BIDPal Support and include your registered email address plus any related order, bid, or case details.</p>
        <p>Thank you,<br />BIDPal Account Safety Team</p>
      </div>
    `,
  });
};
