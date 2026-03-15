'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ChevronLeft,
    Search,
    Send,
    MoreVertical,
    Info,
    Image as ImageIcon,
    Paperclip,
    Smile,
    MessageCircle
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

export default function MessagesPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const isSeller = user?.role?.toLowerCase() === 'seller';

    const [chats, setChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [messagesLoading, setMessagesLoading] = useState(false);

    const fetchConversations = async () => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const token = localStorage.getItem('bidpal_token');
            const res = await fetch(`${apiUrl}/api/messages`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setChats(Array.isArray(data) ? data : []);
            if (data.length > 0 && !selectedChat) {
                // Keep existing selection if possible, otherwise first one
                setSelectedChat(data[0].id);
            }
        } catch (err) {
            console.error('Fetch chats error:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async (convId) => {
        if (!convId) return;
        setMessagesLoading(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const token = localStorage.getItem('bidpal_token');
            const res = await fetch(`${apiUrl}/api/messages/${convId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setMessages(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Fetch messages error:', err);
        } finally {
            setMessagesLoading(false);
        }
    };

    const handleSendMessage = async () => {
        if (!messageInput.trim() || !selectedChat) return;
        const msg = messageInput;
        setMessageInput('');
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const token = localStorage.getItem('bidpal_token');
            const res = await fetch(`${apiUrl}/api/messages/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    conversationId: selectedChat,
                    message: msg
                })
            });
            if (res.ok) {
                fetchMessages(selectedChat);
                fetchConversations();
            }
        } catch (err) {
            console.error('Send message error:', err);
        }
    };

    useEffect(() => {
        if (user) fetchConversations();
    }, [user]);

    useEffect(() => {
        if (selectedChat) fetchMessages(selectedChat);
    }, [selectedChat]);

    const currentChat = chats.find(c => c.id === selectedChat);

    return (
        <div className={styles.messagesContainer}>
            <div className={styles.messagesContent}>
                <header className={styles.messagesHeader}>
                    <button className={styles.backBtn} onClick={() => router.push(isSeller ? '/seller' : '/')}>
                        <ChevronLeft size={20} />
                        <span>{isSeller ? 'Back to Seller Hub' : 'Back to Marketplace'}</span>
                    </button>
                    <h1>{isSeller ? 'Merchant Messages' : 'My Messages'}</h1>
                </header>

                <div className={styles.chatWrapper}>
                    {/* Sidebar / Inbox */}
                    <aside className={styles.inboxSidebar}>
                        <div className={styles.searchBox}>
                            <Search size={18} />
                            <input type="text" placeholder={isSeller ? "Search inquiry..." : "Search messages..."} />
                        </div>
                        <div className={styles.chatsList}>
                            {chats.map(chat => (
                                <div
                                    key={chat.id}
                                    className={`${styles.chatItem} ${selectedChat === chat.id ? styles.activeChat : ''}`}
                                    onClick={() => setSelectedChat(chat.id)}
                                >
                                    <div className={styles.avatarWrapper}>
                                        <img src={chat.avatar} alt={chat.name} />
                                        {chat.online && <div className={styles.onlineStatus}></div>}
                                    </div>
                                    <div className={styles.chatMeta}>
                                        <div className={styles.chatNameRow}>
                                            <span className={styles.chatName}>{chat.name}</span>
                                            <span className={styles.chatTime}>{chat.time}</span>
                                        </div>
                                        <div className={styles.lastMsgRow}>
                                            <p className={styles.lastMessage}>{chat.lastMessage}</p>
                                            {chat.unread > 0 && <span className={styles.unreadBadge}>{chat.unread}</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </aside>

                    {/* Chat Area */}
                    <main className={styles.chatWindow}>
                        {currentChat ? (
                            <>
                                <header className={styles.chatHeader}>
                                    <div className={styles.chatInfo}>
                                        <img src={currentChat.avatar} alt={currentChat.name} />
                                        <div>
                                            <h3>{currentChat.name}</h3>
                                            <span>{currentChat.online ? 'Online' : 'Offline'}</span>
                                        </div>
                                    </div>
                                    <div className={styles.chatActions}>
                                        <button><Info size={20} /></button>
                                        <button><MoreVertical size={20} /></button>
                                    </div>
                                </header>

                                <div className={styles.messageArea}>
                                    {messagesLoading ? (
                                        <div style={{ padding: '2rem', textAlign: 'center' }}>Loading messages...</div>
                                    ) : (
                                        <>
                                            <div className={styles.dateDivider}>Today</div>
                                            {messages.map(msg => (
                                                <div key={msg.message_id} className={`${styles.messageBubble} ${msg.sender_id === user?.user_id ? styles.sent : styles.received}`}>
                                                    <div className={styles.bubbleContent}>
                                                        <p>{msg.content}</p>
                                                        <span className={styles.msgTime}>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>

                                <footer className={styles.inputBar}>
                                    <div className={styles.inputActions}>
                                        <button><Paperclip size={20} /></button>
                                        <button><ImageIcon size={20} /></button>
                                        <button><Smile size={20} /></button>
                                    </div>
                                    <textarea
                                        className={styles.messageTextbox}
                                        placeholder="Type a message..."
                                        value={messageInput}
                                        onChange={(e) => setMessageInput(e.target.value)}
                                        rows={1}
                                    />
                                    <button className={styles.sendBtn} disabled={!messageInput.trim()} onClick={handleSendMessage}>
                                        <Send size={18} />
                                    </button>
                                </footer>
                            </>
                        ) : (
                            <div className={styles.noChatSelected}>
                                <div className={styles.emptyIcon}>
                                    <MessageCircle size={48} />
                                </div>
                                <h2>{isSeller ? 'No inquiry selected' : 'Select a conversation'}</h2>
                                <p>{isSeller ? 'Choose a buyer from the list to respond.' : 'Choose a chat from the left to start messaging sellers.'}</p>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
}
