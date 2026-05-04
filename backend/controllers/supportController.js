import {
  sendSupportInquiryEmail,
  sendSupportReceiptEmail,
} from '../services/emailService.js';
import { supabase } from '../config/supabase.js';
import { createNotification } from './notificationsController.js';

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@bidpal.shop';
const SUPPORT_ACCOUNT_EMAIL = process.env.SUPPORT_ACCOUNT_EMAIL || SUPPORT_EMAIL;

const clean = (value) => String(value || '').trim();

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const resolveSupportUserId = async () => {
  if (process.env.SUPPORT_USER_ID) return process.env.SUPPORT_USER_ID;

  const { data: supportUser } = await supabase
    .from('User')
    .select('user_id')
    .eq('email', SUPPORT_ACCOUNT_EMAIL)
    .maybeSingle();

  return supportUser?.user_id || null;
};

const deliverSupportInquiryToInbox = async ({
  senderUserId,
  userEmail,
  userName,
  category,
  subject,
  message,
  referenceId,
}) => {
  if (!senderUserId) {
    return { delivered: false, reason: 'No logged-in sender user.' };
  }

  const supportUserId = await resolveSupportUserId();
  if (!supportUserId) {
    return { delivered: false, reason: `No BIDPal support account found for ${SUPPORT_ACCOUNT_EMAIL}.` };
  }
  if (supportUserId === senderUserId) {
    return { delivered: false, reason: 'Sender is the support account.' };
  }

  const bodyText = [
    `Support inquiry from ${userName || 'BIDPal User'} <${userEmail}>`,
    `Category: ${category}`,
    referenceId ? `Reference ID: ${referenceId}` : null,
    '',
    `Subject: ${subject}`,
    '',
    message,
  ].filter(Boolean).join('\n');

  const { data: userConvs } = await supabase
    .from('Conversation_participant')
    .select('conversation_id')
    .eq('user_id', senderUserId);

  const { data: supportConvs } = await supabase
    .from('Conversation_participant')
    .select('conversation_id')
    .eq('user_id', supportUserId);

  const common = (userConvs || []).find(uc =>
    (supportConvs || []).some(sc => sc.conversation_id === uc.conversation_id)
  );

  let conversationId = common?.conversation_id;
  const now = new Date().toISOString();

  if (!conversationId) {
    const { data: newConversation, error: conversationError } = await supabase
      .from('Coversations')
      .insert([{
        subject: 'BIDPal Support',
        last_message_at: now,
        created_at: now,
      }])
      .select()
      .single();

    if (conversationError) throw conversationError;
    conversationId = newConversation.conversation_id;

    const { error: participantError } = await supabase
      .from('Conversation_participant')
      .insert([
        { conversation_id: conversationId, user_id: senderUserId },
        { conversation_id: conversationId, user_id: supportUserId },
      ]);

    if (participantError) throw participantError;
  }

  const newEntry = {
    sender_id: senderUserId,
    text: bodyText,
    sent_at: now,
    read_at: null,
    attachment: {},
  };

  const { data: existingMessage, error: existingError } = await supabase
    .from('Messages')
    .select('message_id, body')
    .eq('conversation_id', conversationId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existingMessage) {
    const { error: updateError } = await supabase
      .from('Messages')
      .update({ body: [...(existingMessage.body || []), newEntry] })
      .eq('message_id', existingMessage.message_id);

    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await supabase
      .from('Messages')
      .insert([{ conversation_id: conversationId, body: [newEntry] }]);

    if (insertError) throw insertError;
  }

  await supabase
    .from('Coversations')
    .update({ last_message_at: now })
    .eq('conversation_id', conversationId);

  await createNotification(supportUserId, 'new_message', {
    conversationId,
    senderName: userName || userEmail,
    preview: `Support: ${subject}`.substring(0, 80),
  });

  return { delivered: true, conversationId, supportUserId };
};

export const submitEmailSupportInquiry = async (req, res) => {
  const userEmail = clean(req.body.email);
  const userName = clean(req.body.name);
  const category = clean(req.body.category);
  const subject = clean(req.body.subject);
  const message = clean(req.body.message);
  const referenceId = clean(req.body.referenceId);
  const senderUserId = clean(req.body.user_id);

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
    const delivery = {
      email: false,
      inApp: false,
      inAppReason: null,
    };

    await sendSupportInquiryEmail({
      supportEmail: SUPPORT_EMAIL,
      userEmail,
      userName,
      category,
      subject,
      message,
      referenceId,
    });
    delivery.email = true;

    try {
      const inboxDelivery = await deliverSupportInquiryToInbox({
        senderUserId,
        userEmail,
        userName,
        category,
        subject,
        message,
        referenceId,
      });
      delivery.inApp = inboxDelivery.delivered;
      delivery.inAppReason = inboxDelivery.reason || null;
    } catch (inAppError) {
      console.warn('Support in-app delivery failed:', inAppError.message);
      delivery.inAppReason = inAppError.message;
    }

    try {
      await sendSupportReceiptEmail({ userEmail, userName, subject });
    } catch (receiptError) {
      console.warn('Support receipt email failed:', receiptError.message);
    }

    return res.status(201).json({
      message: delivery.inApp
        ? 'Support inquiry sent to BIDPal support inbox and email.'
        : 'Support inquiry sent by email. BIDPal support will review it and reply through email.',
      supportEmail: SUPPORT_EMAIL,
      delivery,
    });
  } catch (err) {
    console.error('Support inquiry email failed:', err);

    if (err.code === 'EMAIL_NOT_CONFIGURED' || err.code === 'EMAIL_AUTH_FAILED') {
      return res.status(503).json({
        error: `Email support is not configured yet. Please contact BIDPal support directly at ${SUPPORT_EMAIL}.`,
      });
    }

    return res.status(500).json({ error: 'Unable to send your inquiry right now. Please try again later.' });
  }
};
