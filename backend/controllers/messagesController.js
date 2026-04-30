import { supabase } from '../config/supabase.js';
import { createNotification } from './notificationsController.js';
import multer from 'multer';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

// Fetch all conversations for the logged-in user (with unread counts)
export const getConversations = async (req, res) => {
  try {
    const { user_id } = req.user;

    const { data: participants, error: partError } = await supabase
      .from('Conversation_participant')
      .select('conversation_id')
      .eq('user_id', user_id);

    if (partError) throw partError;
    if (!participants || participants.length === 0) return res.json([]);

    const conversationIds = participants.map(p => p.conversation_id);

    const { data: conversations, error: convError } = await supabase
      .from('Coversations')
      .select('conversation_id, subject, last_message_at, created_at')
      .in('conversation_id', conversationIds)
      .order('last_message_at', { ascending: false });

    if (convError) throw convError;

    const { data: allParticipants, error: allPartErr } = await supabase
      .from('Conversation_participant')
      .select('conversation_id, user_id')
      .in('conversation_id', conversationIds);

    if (allPartErr) throw allPartErr;

    const otherUserIds = [...new Set(
      (allParticipants || [])
        .filter(p => p.user_id !== user_id)
        .map(p => p.user_id)
    )];

    let userMap = {};
    if (otherUserIds.length > 0) {
      const { data: users } = await supabase
        .from('User')
        .select('user_id, Fname, Lname, Avatar')
        .in('user_id', otherUserIds);

      const { data: sellers } = await supabase
        .from('Seller')
        .select('seller_id, user_id, store_name, logo_url')
        .in('user_id', otherUserIds);

      const sellerByUser = {};
      (sellers || []).forEach(s => { sellerByUser[s.user_id] = s; });

      (users || []).forEach(u => {
        userMap[u.user_id] = { ...u, seller: sellerByUser[u.user_id] || null };
      });
    }

    const { data: allMsgRows } = await supabase
      .from('Messages')
      .select('conversation_id, body')
      .in('conversation_id', conversationIds);

    const msgRowByConvId = {};
    (allMsgRows || []).forEach(row => { msgRowByConvId[row.conversation_id] = row; });

    const conversationsWithMeta = conversations.map(conv => {
      const msgRow = msgRowByConvId[conv.conversation_id];
      let lastMsg = null;
      let unreadCount = 0;

      if (msgRow?.body && msgRow.body.length > 0) {
        const msgs = msgRow.body;
        lastMsg = msgs[msgs.length - 1];
        unreadCount = msgs.filter(m => m.sender_id !== user_id && m.read_at === null).length;
      }

      const otherParticipant = (allParticipants || []).find(
        p => p.conversation_id === conv.conversation_id && p.user_id !== user_id
      );
      const otherUser = otherParticipant ? (userMap[otherParticipant.user_id] || {}) : {};

      return {
        ...conv,
        lastMessageBody: lastMsg?.text || (lastMsg?.attachment?.name ? `📎 ${lastMsg.attachment.name}` : null),
        lastMsgAt: lastMsg?.sent_at || conv.last_message_at,
        unreadCount,
        otherUser
      };
    });

    const formatted = conversationsWithMeta.map(conv => {
      const otherUser = conv.otherUser;
      const displayName = otherUser.seller?.store_name ||
        (otherUser.Fname ? `${otherUser.Fname} ${otherUser.Lname || ''}`.trim() : 'Unknown User');
      const realName = otherUser.Fname
        ? `${otherUser.Fname} ${otherUser.Lname || ''}`.trim()
        : 'Unknown User';

      return {
        id: conv.conversation_id,
        name: displayName,
        avatar: otherUser.seller?.logo_url || otherUser.Avatar || null,
        lastMessage: conv.lastMessageBody || conv.subject || 'New Inquiry',
        lastMessageAt: conv.lastMsgAt,
        unreadCount: conv.unreadCount,
        otherUser: {
          id: otherUser.user_id,
          name: displayName,
          realName,
          storeName: otherUser.seller?.store_name || null,
          sellerId: otherUser.seller?.seller_id || null,
          avatar: otherUser.seller?.logo_url || otherUser.Avatar || null
        }
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error('getConversations error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Fetch messages for a specific conversation
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { user_id } = req.user;

    const { data: participant, error: partError } = await supabase
      .from('Conversation_participant')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', user_id)
      .single();

    if (partError || !participant) {
      return res.status(403).json({ error: 'You are not a participant in this conversation.' });
    }

    const { data: msgRow, error: msgError } = await supabase
      .from('Messages')
      .select('message_id, body')
      .eq('conversation_id', conversationId)
      .single();

    if (msgError && msgError.code !== 'PGRST116') throw msgError;
    if (!msgRow?.body) return res.json([]);

    const messages = msgRow.body.map((entry, index) => ({
      message_id: `${msgRow.message_id}-${index}`,
      conversation_id: conversationId,
      sender_id: entry.sender_id,
      body: entry.text,
      attachment: entry.attachment || {},
      sent_at: entry.sent_at,
      read_at: entry.read_at
    }));

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get total unread message count for current user
export const getUnreadCount = async (req, res) => {
  try {
    const { user_id } = req.user;

    const { data: parts } = await supabase
      .from('Conversation_participant')
      .select('conversation_id')
      .eq('user_id', user_id);

    if (!parts || parts.length === 0) return res.json({ count: 0 });

    const convIds = parts.map(p => p.conversation_id);

    const { data: msgRows, error } = await supabase
      .from('Messages')
      .select('body')
      .in('conversation_id', convIds);

    if (error) throw error;

    let count = 0;
    for (const row of msgRows || []) {
      for (const entry of row.body || []) {
        if (entry.sender_id !== user_id && entry.read_at === null) count++;
      }
    }

    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Mark all unread messages in a conversation as read
export const markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { user_id } = req.user;

    const { data: msgRow, error: fetchErr } = await supabase
      .from('Messages')
      .select('message_id, body')
      .eq('conversation_id', conversationId)
      .single();

    if (fetchErr || !msgRow) return res.json({ success: true });

    const now = new Date().toISOString();
    const updatedBody = msgRow.body.map(entry => {
      if (entry.sender_id !== user_id && entry.read_at === null) {
        return { ...entry, read_at: now };
      }
      return entry;
    });

    const { error } = await supabase
      .from('Messages')
      .update({ body: updatedBody })
      .eq('conversation_id', conversationId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Send a message (text and/or attachment)
export const sendMessage = async (req, res) => {
  try {
    const { receiverId, message, conversationId, attachment_url, attachment_type, attachment_name, attachment_size } = req.body;
    const { user_id } = req.user;

    if (!message && !attachment_url) {
      return res.status(400).json({ error: 'Message text or attachment is required.' });
    }
    if (!receiverId && !conversationId) {
      return res.status(400).json({ error: 'receiverId or conversationId is required.' });
    }

    let finalConvId = conversationId;
    let actualReceiverId = receiverId;

    if (!finalConvId) {
      const { data: userConvs } = await supabase.from('Conversation_participant').select('conversation_id').eq('user_id', user_id);
      const { data: receiverConvs } = await supabase.from('Conversation_participant').select('conversation_id').eq('user_id', receiverId);

      const common = userConvs?.filter(uc => receiverConvs?.some(rc => rc.conversation_id === uc.conversation_id));

      if (common && common.length > 0) {
        finalConvId = common[0].conversation_id;
      } else {
        const { data: newConv, error: newConvError } = await supabase
          .from('Coversations')
          .insert([{
            subject: 'New Inquiry',
            last_message_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (newConvError) throw newConvError;
        finalConvId = newConv.conversation_id;

        const { error: partError } = await supabase
          .from('Conversation_participant')
          .insert([
            { conversation_id: finalConvId, user_id: user_id },
            { conversation_id: finalConvId, user_id: receiverId }
          ]);

        if (partError) throw partError;
      }
    } else {
      const { data: parts } = await supabase
        .from('Conversation_participant')
        .select('user_id')
        .eq('conversation_id', finalConvId)
        .neq('user_id', user_id);
      actualReceiverId = parts?.[0]?.user_id || null;
    }

    const attachment = attachment_url
      ? { url: attachment_url, type: attachment_type || 'file', name: attachment_name || 'Attachment', size: attachment_size || 0 }
      : {};

    const newEntry = {
      sender_id: user_id,
      text: message || '',
      sent_at: new Date().toISOString(),
      read_at: null,
      attachment
    };

    const { data: existing, error: fetchErr } = await supabase
      .from('Messages')
      .select('message_id, body')
      .eq('conversation_id', finalConvId)
      .single();

    let msgData;
    if (fetchErr?.code === 'PGRST116' || !existing) {
      const { data, error: insertErr } = await supabase
        .from('Messages')
        .insert([{ conversation_id: finalConvId, body: [newEntry] }])
        .select()
        .single();
      if (insertErr) throw insertErr;
      msgData = data;
    } else {
      const updatedBody = [...existing.body, newEntry];
      const { data, error: updateErr } = await supabase
        .from('Messages')
        .update({ body: updatedBody })
        .eq('conversation_id', finalConvId)
        .select()
        .single();
      if (updateErr) throw updateErr;
      msgData = data;
    }

    await supabase
      .from('Coversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('conversation_id', finalConvId);

    const { data: senderData } = await supabase
      .from('User')
      .select('Fname, Lname')
      .eq('user_id', user_id)
      .single();

    const { data: senderSeller } = await supabase
      .from('Seller')
      .select('store_name')
      .eq('user_id', user_id)
      .maybeSingle();

    const senderName = senderSeller?.store_name ||
      (senderData?.Fname ? `${senderData.Fname} ${senderData.Lname || ''}`.trim() : 'Someone');

    if (actualReceiverId) {
      await createNotification(actualReceiverId, 'new_message', {
        conversationId: finalConvId,
        senderName,
        preview: (message || '📎 Attachment').substring(0, 80)
      });
    }

    const newIndex = msgData.body.length - 1;
    res.status(201).json({
      message_id: `${msgData.message_id}-${newIndex}`,
      conversation_id: finalConvId,
      sender_id: user_id,
      body: message || '',
      attachment,
      sent_at: newEntry.sent_at,
      read_at: null
    });
  } catch (err) {
    console.error('sendMessage error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Ensure the chat-media bucket exists (creates it if missing)
const ensureChatMediaBucket = async () => {
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) throw listErr;
  const exists = (buckets || []).some(b => b.id === 'chat-media' || b.name === 'chat-media');
  if (!exists) {
    const { error: createErr } = await supabase.storage.createBucket('chat-media', {
      public: true,
      fileSizeLimit: 20971520 // 20MB
    });
    if (createErr) throw createErr;
  }
};

// Upload a file/image to Supabase chat-media bucket
export const uploadMessageMedia = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    await ensureChatMediaBucket();

    const { user_id } = req.user;
    const file = req.file;
    const ext = (file.originalname.split('.').pop() || 'bin').toLowerCase();
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = `${user_id}/${safeName}`;

    const { error: uploadErr } = await supabase.storage
      .from('chat-media')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (uploadErr) {
      console.error('Supabase storage upload error:', uploadErr);
      throw uploadErr;
    }

    const { data: urlData } = supabase.storage
      .from('chat-media')
      .getPublicUrl(filePath);

    const isImage = file.mimetype.startsWith('image/');

    res.json({
      url: urlData.publicUrl,
      type: isImage ? 'image' : 'file',
      name: file.originalname,
      size: file.size
    });
  } catch (err) {
    console.error('uploadMessageMedia error:', err.message || err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
};

// Delete a single message from a conversation (sender only)
export const deleteMessage = async (req, res) => {
  try {
    const { conversationId, sentAt } = req.params;
    const { user_id } = req.user;

    const { data: participant } = await supabase
      .from('Conversation_participant')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user_id)
      .single();

    if (!participant) return res.status(403).json({ error: 'Not a participant.' });

    const { data: msgRow } = await supabase
      .from('Messages')
      .select('message_id, body')
      .eq('conversation_id', conversationId)
      .single();

    if (!msgRow) return res.status(404).json({ error: 'Messages not found.' });

    const decodedSentAt = decodeURIComponent(sentAt);
    let deleted = false;
    const updatedBody = msgRow.body.filter(entry => {
      if (entry.sent_at === decodedSentAt && entry.sender_id === user_id) {
        deleted = true;
        return false;
      }
      return true;
    });

    if (!deleted) return res.status(404).json({ error: 'Message not found or not yours.' });

    const { error } = await supabase
      .from('Messages')
      .update({ body: updatedBody })
      .eq('conversation_id', conversationId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Leave / delete a conversation
export const deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { user_id } = req.user;

    const { error: deletePartErr } = await supabase
      .from('Conversation_participant')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', user_id);

    if (deletePartErr) throw deletePartErr;

    const { data: remaining } = await supabase
      .from('Conversation_participant')
      .select('user_id')
      .eq('conversation_id', conversationId);

    if (!remaining || remaining.length === 0) {
      await supabase.from('Messages').delete().eq('conversation_id', conversationId);
      await supabase.from('Coversations').delete().eq('conversation_id', conversationId);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Block a user (stored as restriction_type = "blocked:<targetUserId>")
export const blockUser = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const { user_id } = req.user;

    if (!targetUserId) return res.status(400).json({ error: 'targetUserId required.' });

    const restrictionType = `blocked:${targetUserId}`;

    const { data: existing } = await supabase
      .from('Account_Restrictions')
      .select('user_id')
      .eq('user_id', user_id)
      .eq('restriction_type', restrictionType)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('Account_Restrictions')
        .update({ is_active: true })
        .eq('user_id', user_id)
        .eq('restriction_type', restrictionType);
    } else {
      const { error } = await supabase
        .from('Account_Restrictions')
        .insert([{ user_id, restriction_type: restrictionType, is_active: true }]);
      if (error) throw error;
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Unblock a user
export const unblockUser = async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const { user_id } = req.user;

    const { error } = await supabase
      .from('Account_Restrictions')
      .update({ is_active: false })
      .eq('user_id', user_id)
      .eq('restriction_type', `blocked:${targetUserId}`);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all users blocked by the current user
export const getBlockedUsers = async (req, res) => {
  try {
    const { user_id } = req.user;

    const { data, error } = await supabase
      .from('Account_Restrictions')
      .select('restriction_type')
      .eq('user_id', user_id)
      .eq('is_active', true)
      .like('restriction_type', 'blocked:%');

    if (error) throw error;

    const blockedIds = (data || []).map(r => r.restriction_type.replace('blocked:', ''));
    res.json(blockedIds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
