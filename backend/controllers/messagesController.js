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

    // For each conversation, fetch last message + unread count for this user
    const conversationsWithMeta = await Promise.all(
      conversations.map(async (conv) => {
        const [lastMsgRes, unreadRes] = await Promise.all([
          supabase
            .from('Messages')
            .select('body, sent_at')
            .eq('conversation_id', conv.conversation_id)
            .order('sent_at', { ascending: false })
            .limit(1),
          supabase
            .from('Messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.conversation_id)
            .neq('sender_id', user_id)
            .is('read_at', null)
        ]);

        const lastMsg = lastMsgRes.data?.[0] || null;
        const unreadCount = unreadRes.count || 0;

        return { ...conv, lastMessageBody: lastMsg?.body || null, lastMsgAt: lastMsg?.sent_at || conv.last_message_at, unreadCount };
      })
    );

    // Format response, highlighting the "other" user
    const formatted = conversationsWithMeta.map(conv => {
      const otherPart = conv.Conversation_participant.find(p => p.user_id !== user_id);
      const otherUser = otherPart?.User || {};

      const displayName = otherUser.Seller?.[0]?.store_name ||
        (otherUser.Fname ? `${otherUser.Fname} ${otherUser.Lname || ''}`.trim() : 'Unknown User');

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

    const { data: messages, error: msgError } = await supabase
      .from('Messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('sent_at', { ascending: true });

    if (msgError) throw msgError;
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get total unread message count for current user
export const getUnreadCount = async (req, res) => {
  try {
    const { user_id } = req.user;

    // Get all conversations for this user
    const { data: parts } = await supabase
      .from('Conversation_participant')
      .select('conversation_id')
      .eq('user_id', user_id);

    if (!parts || parts.length === 0) return res.json({ count: 0 });

    const convIds = parts.map(p => p.conversation_id);

    const { count, error } = await supabase
      .from('Messages')
      .select('*', { count: 'exact', head: true })
      .in('conversation_id', convIds)
      .neq('sender_id', user_id)
      .is('read_at', null);

    if (error) throw error;
    res.json({ count: count || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Mark all unread messages in a conversation as read
export const markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { user_id } = req.user;

    // Only mark messages sent by others as read
    const { error } = await supabase
      .from('Messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user_id)
      .is('read_at', null);

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

    // Insert message
    const { data: msgData, error: msgError } = await supabase
      .from('Messages')
      .insert([{
        conversation_id: finalConvId,
        sender_id: user_id,
        body: message,
        attachment: {},
        sent_at: new Date().toISOString(),
        read_at: null // null = unread
      }])
      .select()
      .single();

    if (msgError) throw msgError;

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

    res.status(201).json(msgData);
  } catch (err) {
    console.error('sendMessage error:', err);
    res.status(500).json({ error: err.message });
  }
};
