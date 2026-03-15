import { supabase } from '../config/supabase.js';

// Fetch all conversations for the logged-in user
export const getConversations = async (req, res) => {
  try {
    const { user_id } = req.user;

    // First get the conversations this user is part of
    const { data: participants, error: partError } = await supabase
      .from('Conversation_participant')
      .select('conversation_id')
      .eq('user_id', user_id);

    if (partError) throw partError;
    if (!participants || participants.length === 0) return res.json([]);

    const conversationIds = participants.map(p => p.conversation_id);

    // Fetch conversation details including the OTHER participant
    // Note: 'Coversations' has a typo in the schema
    const { data: conversations, error: convError } = await supabase
      .from('Coversations')
      .select(`
        conversation_id,
        last_message,
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

    // Format the response to highlight the "other user"
    const formatted = conversations.map(conv => {
      const otherPart = conv.Conversation_participant.find(p => p.user_id !== user_id);
      const otherUser = otherPart?.User || {};
      
      const displayName = otherUser.Seller?.[0]?.store_name || 
                         (otherUser.Fname ? `${otherUser.Fname} ${otherUser.Lname || ''}`.trim() : 'Unknown User');

      return {
        id: conv.conversation_id,
        lastMessage: conv.last_message,
        lastMessageAt: conv.last_message_at,
        otherUser: {
          id: otherUser.user_id,
          name: displayName,
          avatar: otherUser.Seller?.[0]?.logo_url || otherUser.Avatar
        }
      };
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Fetch messages for a specific conversation
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { user_id } = req.user;

    // Security check: Is this user part of this conversation?
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
      .order('created_at', { ascending: true });

    if (msgError) throw msgError;
    res.json(messages);
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

    // If no conversationId, check if one exists or create a new one
    if (!finalConvId) {
      // Find common conversation between user_id and receiverId
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
              last_message: message, 
              last_message_at: new Date().toISOString() 
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
    }

    // Insert message
    const { data: msgData, error: msgError } = await supabase
      .from('Messages')
      .insert([{
        conversation_id: finalConvId,
        sender_id: user_id,
        content: message,
        read_at: new Date().toISOString(), // Satisfying NOT NULL constraint temporarily
        attachment: null
      }])
      .select()
      .single();

    if (msgError) throw msgError;

    // Update conversation last message
    await supabase
      .from('Coversations')
      .update({ 
          last_message: message, 
          last_message_at: new Date().toISOString() 
      })
      .eq('conversation_id', finalConvId);

    res.status(201).json(msgData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
