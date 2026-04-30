import {
  sendSupportInquiryEmail,
  sendSupportReceiptEmail,
} from '../services/emailService.js';

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@bidpal.ph';

const clean = (value) => String(value || '').trim();

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const submitEmailSupportInquiry = async (req, res) => {
  const userEmail = clean(req.body.email);
  const userName = clean(req.body.name);
  const category = clean(req.body.category);
  const subject = clean(req.body.subject);
  const message = clean(req.body.message);
  const referenceId = clean(req.body.referenceId);

  if (!userEmail || !isEmail(userEmail)) {
    return res.status(400).json({ error: 'Please provide a valid reply email.' });
  }

  if (!category) {
    return res.status(400).json({ error: 'Please choose a support category.' });
  }

  if (subject.length < 5) {
    return res.status(400).json({ error: 'Please enter a subject with at least 5 characters.' });
  }

  if (message.length < 20) {
    return res.status(400).json({ error: 'Please describe your concern in at least 20 characters.' });
  }

  try {
    await sendSupportInquiryEmail({
      supportEmail: SUPPORT_EMAIL,
      userEmail,
      userName,
      category,
      subject,
      message,
      referenceId,
    });

    try {
      await sendSupportReceiptEmail({ userEmail, userName, subject });
    } catch (receiptError) {
      console.warn('Support receipt email failed:', receiptError.message);
    }

    return res.status(201).json({
      message: 'Support inquiry sent. BIDPal support will review it and reply through email.',
      supportEmail: SUPPORT_EMAIL,
    });
  } catch (err) {
    console.error('Support inquiry email failed:', err);

    if (err.code === 'EMAIL_NOT_CONFIGURED' || err.code === 'EMAIL_AUTH_FAILED') {
      return res.status(503).json({
        error: 'Email support is not configured yet. Please contact BIDPal support directly at support@bidpal.ph.',
      });
    }

    return res.status(500).json({ error: 'Unable to send your inquiry right now. Please try again later.' });
  }
};
