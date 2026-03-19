import { supabase } from './config/supabase.js';

// Simulating the getConversations function logic
async function testGetConversations() {
  const user_id = '5da91e28-94db-484d-9d10-b71eb9bf6274';

  try {
    console.log('Testing getConversations for user:', user_id);

    // First get the conversations this user is part of
    const { data: participants, error: partError } = await supabase
      .from('Conversation_participant')
      .select('conversation_id')
      .eq('user_id', user_id);

    if (partError) throw partError;
    if (!participants || participants.length === 0) {
      console.log('No conversations found');
      return [];
    }

    const conversationIds = participants.map(p => p.conversation_id);
    console.log('\nConversation IDs:', conversationIds);

    // Fetch conversation details
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

    console.log('\nFound', conversations.length, 'conversations');

    // Fetch the last message for each conversation
    const conversationsWithLastMessage = await Promise.all(
      conversations.map(async (conv) => {
        const { data: messages, error: msgError } = await supabase
          .from('Messages')
          .select('body, created_at')
          .eq('conversation_id', conv.conversation_id)
          .order('created_at', { ascending: false })
          .limit(1);

        const lastMsg = messages && messages.length > 0 ? messages[0] : null;
        console.log(`\nConversation ${conv.conversation_id}:`);
        console.log('  - Subject:', conv.subject);
        console.log('  - Last message:', lastMsg?.body || 'NO MESSAGES');

        return { ...conv, lastMessageBody: lastMsg?.body || null };
      })
    );

    // Format the response
    const formatted = conversationsWithLastMessage.map(conv => {
      const otherPart = conv.Conversation_participant.find(p => p.user_id !== user_id);
      const otherUser = otherPart?.User || {};

      const displayName = otherUser.Seller?.[0]?.store_name ||
                         (otherUser.Fname ? `${otherUser.Fname} ${otherUser.Lname || ''}`.trim() : 'Unknown User');

      return {
        id: conv.conversation_id,
        name: displayName,
        lastMessage: conv.lastMessageBody || conv.subject || 'New Inquiry',
        lastMessageAt: conv.last_message_at,
      };
    });

    console.log('\n\n=== FINAL OUTPUT ===');
    console.log(JSON.stringify(formatted, null, 2));

    return formatted;
  } catch (err) {
    console.error('Error:', err.message);
    throw err;
  }
}

testGetConversations();
