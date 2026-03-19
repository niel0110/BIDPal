import { supabase } from './config/supabase.js';

// Test user ID - replace with actual user ID from your database
const testUserId = '5da91e28-94db-484d-9d10-b71eb9bf6274';

async function testMessages() {
  console.log('Testing messages for user:', testUserId);

  // Get conversations
  const { data: participants, error: partError } = await supabase
    .from('Conversation_participant')
    .select('conversation_id')
    .eq('user_id', testUserId);

  console.log('\n1. Participants:', JSON.stringify(participants, null, 2));

  if (!participants || participants.length === 0) {
    console.log('No conversations found for this user');
    return;
  }

  const conversationIds = participants.map(p => p.conversation_id);
  console.log('\n2. Conversation IDs:', conversationIds);

  // Get conversation details
  const { data: conversations, error: convError } = await supabase
    .from('Coversations')
    .select(`
      conversation_id,
      subject,
      last_message_at,
      created_at
    `)
    .in('conversation_id', conversationIds);

  console.log('\n3. Conversations:', JSON.stringify(conversations, null, 2));

  // Get messages for first conversation
  if (conversations && conversations.length > 0) {
    const firstConvId = conversations[0].conversation_id;
    console.log('\n4. Fetching messages for conversation:', firstConvId);

    const { data: messages, error: msgError } = await supabase
      .from('Messages')
      .select('*')
      .eq('conversation_id', firstConvId)
      .order('created_at', { ascending: false });

    console.log('\n5. Messages:', JSON.stringify(messages, null, 2));
    console.log('\n6. Total messages:', messages?.length || 0);

    if (messages && messages.length > 0) {
      console.log('\n7. Last message body:', messages[0].body);
    } else {
      console.log('\n7. No messages found in this conversation');
    }
  }
}

testMessages().catch(console.error);
