import { supabase } from '../config/supabase.js';
import { createNotification } from './notificationsController.js';

// Fetch all conversations for the logged-in user (with unread counts)
export const getConversations = async (req, res) => {
  try {
    const { user_id } = req.user;

    // Get conversation IDs this user participates in
    const { data: participants, error: partError } = await supabase
      .from('Conversation_participant')
      .select('conversation_id')
      .eq('user_id', user_id);

    if (partError) throw partError;
    if (!participants || participants.length === 0) return res.json([]);

    const conversationIds = participants.map(p => p.conversation_id);

    // Fetch conversation details with other participant info
    const { data: conversations, error: convError } = await supabase
      .from('Coversations')
      .select(`
        conversation_id,
        subject,
        last_message_at,
        created_at,
        Conversation_participant (
          user_id,
          User (
            user_id,
            Fname,
            Lname,
            Avatar,
            Seller (
              store_name,
              logo_url
            )
          )
        )
      `)
      .in('conversation_id', conversationIds)
      .order('last_message_at', { ascending: false });

    if (convError) throw convError;

    // For each conversation, fetch last message + unread count from the JSONB body
    const conversationsWithMeta = await Promise.all(
      conversations.map(async (conv) => {
        const { data: msgRow } = await supabase
          .from('Messages')
          .select('body')
          .eq('conversation_id', conv.conversation_id)
          .single();

        let lastMsg = null;
        let unreadCount = 0;

        if (msgRow?.body && msgRow.body.length > 0) {
          const msgs = msgRow.body;
          lastMsg = msgs[msgs.length - 1];
          unreadCount = msgs.filter(m => m.sender_id !== user_id && m.read_at === null).length;
        }

        return {
          ...conv,
          lastMessageBody: lastMsg?.text || null,
          lastMsgAt: lastMsg?.sent_at || conv.last_message_at,
          unreadCount
        };
      })
    );

    // Format response, highlighting the "other" user
    const formatted = conversationsWithMeta.map(conv => {
      const otherPart = conv.Conversation_participant.find(p => p.user_id !== user_id);
      const otherUser = otherPart?.User || {};

      const displayName = otherUser.Seller?.[0]?.store_name ||
        (otherUser.Fname ? `${otherUser.Fname} ${otherUser.Lname || ''}`.trim() : 'Unknown User');

      const realName = otherUser.Fname
        ? `${otherUser.Fname} ${otherUser.Lname || ''}`.trim()
        : 'Unknown User';

      return {
        id: conv.conversation_id,
        name: displayName,
        avatar: otherUser.Seller?.[0]?.logo_url || otherUser.Avatar || null,
        lastMessage: conv.lastMessageBody || conv.subject || 'New Inquiry',
        lastMessageAt: conv.lastMsgAt,
        unreadCount: conv.unreadCount,
        otherUser: {
          id: otherUser.user_id,
          name: displayName,
          realName,
          storeName: otherUser.Seller?.[0]?.store_name || null,
          avatar: otherUser.Seller?.[0]?.logo_url || otherUser.Avatar || null
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

    // Security check: Must be a participant
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

    // PGRST116 = row not found — conversation has no messages yet
    if (msgError && msgError.code !== 'PGRST116') throw msgError;
    if (!msgRow?.body) return res.json([]);

    // Transform JSONB array entries into flat message objects for the frontend
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

// Send a message
export const sendMessage = async (req, res) => {
  try {
    const { receiverId, message, conversationId } = req.body;
    const { user_id } = req.user;

    if (!message || (!receiverId && !conversationId)) {
      return res.status(400).json({ error: 'Message and (receiverId or conversationId) are required.' });
    }

    let finalConvId = conversationId;
    let actualReceiverId = receiverId;

    // If no conversationId, find or create one
    if (!finalConvId) {
      const { data: userConvs } = await supabase.from('Conversation_participant').select('conversation_id').eq('user_id', user_id);
      const { data: receiverConvs } = await supabase.from('Conversation_participant').select('conversation_id').eq('user_id', receiverId);

      const common = userConvs?.filter(uc => receiverConvs?.some(rc => rc.conversation_id === uc.conversation_id));

      if (common && common.length > 0) {
        finalConvId = common[0].conversation_id;
      } else {
        // Create new conversation
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

        // Add participants
        const { error: partError } = await supabase
          .from('Conversation_participant')
          .insert([
            { conversation_id: finalConvId, user_id: user_id },
            { conversation_id: finalConvId, user_id: receiverId }
          ]);

        if (partError) throw partError;
      }
    } else {
      // Find receiver from existing conversation participants
      const { data: parts } = await supabase
        .from('Conversation_participant')
        .select('user_id')
        .eq('conversation_id', finalConvId)
        .neq('user_id', user_id);
      actualReceiverId = parts?.[0]?.user_id || null;
    }

    const newEntry = {
      sender_id: user_id,
      text: message,
      sent_at: new Date().toISOString(),
      read_at: null,
      attachment: {}
    };

    // Check if a Messages row already exists for this conversation
    const { data: existing, error: fetchErr } = await supabase
      .from('Messages')
      .select('message_id, body')
      .eq('conversation_id', finalConvId)
      .single();

    let msgData;
    if (fetchErr?.code === 'PGRST116' || !existing) {
      // No row yet — insert the first message
      const { data, error: insertErr } = await supabase
        .from('Messages')
        .insert([{
          conversation_id: finalConvId,
          body: [newEntry]
        }])
        .select()
        .single();
      if (insertErr) throw insertErr;
      msgData = data;
    } else {
      // Row exists — append new entry to the JSONB array
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

    // Update conversation's last_message_at
    await supabase
      .from('Coversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('conversation_id', finalConvId);

    // Fetch sender display name for notification
    const { data: senderData } = await supabase
      .from('User')
      .select('Fname, Lname, Seller(store_name)')
      .eq('user_id', user_id)
      .single();

    const senderName = senderData?.Seller?.[0]?.store_name ||
      (senderData?.Fname ? `${senderData.Fname} ${senderData.Lname || ''}`.trim() : 'Someone');

    // Create notification for receiver
    if (actualReceiverId) {
      await createNotification(actualReceiverId, 'new_message', {
        conversationId: finalConvId,
        senderName,
        preview: message.substring(0, 80)
      });
    }

    // Return flat message object matching the frontend's expected shape
    const newIndex = msgData.body.length - 1;
    res.status(201).json({
      message_id: `${msgData.message_id}-${newIndex}`,
      conversation_id: finalConvId,
      sender_id: user_id,
      body: message,
      attachment: {},
      sent_at: newEntry.sent_at,
      read_at: null
    });
  } catch (err) {
    console.error('sendMessage error:', err);
    res.status(500).json({ error: err.message });
  }
};
