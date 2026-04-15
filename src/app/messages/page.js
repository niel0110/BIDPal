'use client';

import BackButton from '@/components/BackButton';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
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
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const POLL_INTERVAL = 5000; // 5 seconds

function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = (Date.now() - new Date(dateStr)) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function avatarFallback(e) {
    e.target.src = 'https://placehold.co/48x48?text=?';
}

function MessagesPageInner() {
    const { user } = useAuth();
    const isSeller = user?.role?.toLowerCase() === 'seller';

    const searchParams = useSearchParams();
    const receiverIdParam = searchParams.get('receiverId');

    const [chats, setChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [pendingReceiver, setPendingReceiver] = useState(null);
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [mobileShowChat, setMobileShowChat] = useState(false);
    const messagesEndRef = useRef(null);
    const pollRef = useRef(null);

    const getToken = () => localStorage.getItem('bidpal_token');

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => { scrollToBottom(); }, [messages]);

    const fetchConversations = useCallback(async (isInitial = false) => {
        try {
            const res = await fetch(`${API_URL}/api/messages`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (!res.ok) return;
            const data = await res.json();
            setChats(Array.isArray(data) ? data : []);

            if (isInitial) {
                if (receiverIdParam) {
                    const existing = data.find(c => c.otherUser?.id === receiverIdParam);
                    if (existing) {
                        setSelectedChat(existing.id);
                    } else {
                        fetchPendingReceiver(receiverIdParam);
                    }
                } else if (data.length > 0 && !selectedChat) {
                    setSelectedChat(data[0].id);
                }
            }
        } catch (err) {
            console.error('Fetch chats error:', err);
        } finally {
            if (isInitial) setLoading(false);
        }
    }, [receiverIdParam]);

    const fetchPendingReceiver = async (receiverId) => {
        try {
            const res = await fetch(`${API_URL}/api/sellers/user/${receiverId}`);
            if (res.ok) {
                const sellerData = await res.json();
                setPendingReceiver({
                    id: receiverId,
                    name: sellerData.store_name || sellerData.Fname || 'Seller',
                    avatar: sellerData.logo_url || sellerData.Avatar || null
                });
                setSelectedChat(`pending-${receiverId}`);
            } else {
                // Fallback: try user endpoint
                const userRes = await fetch(`${API_URL}/api/users/${receiverId}`);
                if (userRes.ok) {
                    const userData = await userRes.json();
                    setPendingReceiver({
                        id: receiverId,
                        name: `${userData.Fname || ''} ${userData.Lname || ''}`.trim() || 'User',
                        avatar: userData.Avatar || null
                    });
                    setSelectedChat(`pending-${receiverId}`);
                }
            }
        } catch (err) {
            console.error('Fetch pending receiver error:', err);
        }
    };

    const fetchMessages = useCallback(async (convId) => {
        if (!convId || convId.toString().startsWith('pending-')) {
            setMessages([]);
            return;
        }
        setMessagesLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/messages/${convId}`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (!res.ok) return;
            const data = await res.json();
            setMessages(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Fetch messages error:', err);
        } finally {
            setMessagesLoading(false);
        }
    }, []);

    const markAsRead = useCallback(async (convId) => {
        if (!convId || convId.toString().startsWith('pending-')) return;
        try {
            await fetch(`${API_URL}/api/messages/${convId}/read`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            // Update local unread count
            setChats(prev => prev.map(c => c.id === convId ? { ...c, unreadCount: 0 } : c));
        } catch (err) {}
    }, []);

    const handleSendMessage = async () => {
        if (!messageInput.trim() || !selectedChat || sending) return;
        const msg = messageInput.trim();
        setMessageInput('');
        setSending(true);
        try {
            const isPending = selectedChat.toString().startsWith('pending-');
            const res = await fetch(`${API_URL}/api/messages/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({
                    conversationId: isPending ? null : selectedChat,
                    receiverId: isPending ? pendingReceiver?.id : undefined,
                    message: msg
                })
            });
            if (res.ok) {
                const newMsg = await res.json();
                // If was pending, refresh conversations to get real convId
                if (isPending) {
                    await fetchConversations(false);
                    const freshRes = await fetch(`${API_URL}/api/messages`, {
                        headers: { 'Authorization': `Bearer ${getToken()}` }
                    });
                    const freshData = await freshRes.json();
                    setChats(Array.isArray(freshData) ? freshData : []);
                    const found = freshData.find(c => c.otherUser?.id === pendingReceiver?.id);
                    if (found) {
                        setSelectedChat(found.id);
                        setPendingReceiver(null);
                    }
                } else {
                    setMessages(prev => {
                        if (prev.some(m => m.message_id === newMsg.message_id)) return prev;
                        return [...prev, newMsg];
                    });
                    fetchConversations(false);
                }
            }
        } catch (err) {
            console.error('Send message error:', err);
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Initial load
    useEffect(() => {
        if (user) fetchConversations(true);
    }, [user]);

    // Polling for new messages
    useEffect(() => {
        if (!user) return;
        pollRef.current = setInterval(() => {
            fetchConversations(false);
            if (selectedChat && !selectedChat.toString().startsWith('pending-')) {
                fetchMessages(selectedChat);
            }
        }, POLL_INTERVAL);
        return () => clearInterval(pollRef.current);
    }, [user, selectedChat, fetchConversations, fetchMessages]);

    // Fetch messages when conversation selected
    useEffect(() => {
        if (selectedChat) {
            fetchMessages(selectedChat);
            markAsRead(selectedChat);
        }
    }, [selectedChat]);

    const currentChat = chats.find(c => c.id === selectedChat) ||
        (pendingReceiver && selectedChat === `pending-${pendingReceiver.id}` ? {
            id: `pending-${pendingReceiver.id}`,
            name: pendingReceiver.name,
            avatar: pendingReceiver.avatar,
            lastMessage: 'Start a conversation...'
        } : null);

    const filteredChats = chats.filter(c =>
        c.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelectChat = (chatId) => {
        setSelectedChat(chatId);
        markAsRead(chatId);
        setMobileShowChat(true);
    };

    return (
        <div className={styles.messagesContainer}>
            <div className={styles.messagesContent}>
                <header className={styles.messagesHeader}>
                    <BackButton label="Back" />
                    <h1>{isSeller ? 'Merchant Messages' : 'My Messages'}</h1>
                </header>

                <div className={`${styles.chatWrapper} ${mobileShowChat ? styles.mobileShowChat : ''}`}>
                    {/* Sidebar / Inbox */}
                    <aside className={styles.inboxSidebar}>
                        <div className={styles.searchBox}>
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder={isSeller ? 'Search inquiry...' : 'Search messages...'}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className={styles.chatsList}>
                            {loading ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: '#aaa' }}>Loading...</div>
                            ) : (
                                <>
                                    {filteredChats.map(chat => (
                                        <div
                                            key={chat.id}
                                            className={`${styles.chatItem} ${selectedChat === chat.id ? styles.activeChat : ''}`}
                                            onClick={() => handleSelectChat(chat.id)}
                                        >
                                            <div className={styles.avatarWrapper}>
                                                <img
                                                    src={chat.avatar || 'https://placehold.co/48x48?text=?'}
                                                    alt={chat.name}
                                                    onError={avatarFallback}
                                                />
                                            </div>
                                            <div className={styles.chatMeta}>
                                                <div className={styles.chatNameRow}>
                                                    <span className={styles.chatName}>{chat.name}</span>
                                                    <span className={styles.chatTime}>{timeAgo(chat.lastMessageAt)}</span>
                                                </div>
                                                <div className={styles.lastMsgRow}>
                                                    <p className={styles.lastMessage}>{chat.lastMessage}</p>
                                                    {chat.unreadCount > 0 && (
                                                        <span className={styles.unreadBadge}>{chat.unreadCount}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {pendingReceiver && !chats.some(c => c.otherUser?.id === pendingReceiver.id) && (
                                        <div
                                            className={`${styles.chatItem} ${selectedChat === `pending-${pendingReceiver.id}` ? styles.activeChat : ''}`}
                                            onClick={() => { setSelectedChat(`pending-${pendingReceiver.id}`); setMobileShowChat(true); }}
                                        >
                                            <div className={styles.avatarWrapper}>
                                                <img
                                                    src={pendingReceiver.avatar || 'https://placehold.co/48x48?text=?'}
                                                    alt={pendingReceiver.name}
                                                    onError={avatarFallback}
                                                />
                                            </div>
                                            <div className={styles.chatMeta}>
                                                <div className={styles.chatNameRow}>
                                                    <span className={styles.chatName}>{pendingReceiver.name}</span>
                                                    <span className={styles.chatTime}>New</span>
                                                </div>
                                                <div className={styles.lastMsgRow}>
                                                    <p className={styles.lastMessage}>Start a conversation...</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {filteredChats.length === 0 && !pendingReceiver && (
                                        <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#ccc' }}>
                                            <MessageCircle size={32} style={{ marginBottom: 8 }} />
                                            <p style={{ margin: 0, fontSize: '0.9rem' }}>No conversations yet</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </aside>

                    {/* Chat Area */}
                    <main className={styles.chatWindow}>
                        {currentChat ? (
                            <>
                                <header className={styles.chatHeader}>
                                    <button
                                        className={styles.mobileBackBtn}
                                        onClick={() => setMobileShowChat(false)}
                                        title="Back to inbox"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <div className={styles.chatInfo}>
                                        <img
                                            src={currentChat.avatar || 'https://placehold.co/36x36?text=?'}
                                            alt={currentChat.name}
                                            onError={avatarFallback}
                                        />
                                        <div>
                                            <h3>{currentChat.name}</h3>
                                        </div>
                                    </div>
                                    <div className={styles.chatActions}>
                                        <button title="Info"><Info size={20} /></button>
                                        <button title="Options"><MoreVertical size={20} /></button>
                                    </div>
                                </header>

                                <div className={styles.messageArea}>
                                    {messagesLoading ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: '#aaa' }}>
                                            Loading messages...
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <div style={{ padding: '3rem', textAlign: 'center', color: '#ccc' }}>
                                            <MessageCircle size={40} style={{ marginBottom: 8 }} />
                                            <p style={{ margin: 0 }}>Send the first message!</p>
                                        </div>
                                    ) : (
                                        <>
                                            {messages.map((msg, i) => {
                                                const isOwn = msg.sender_id === user?.user_id;
                                                const prevMsg = messages[i - 1];
                                                const showDate = !prevMsg ||
                                                    new Date(msg.sent_at).toDateString() !== new Date(prevMsg.sent_at).toDateString();
                                                return (
                                                    <div key={msg.message_id}>
                                                        {showDate && (
                                                            <div className={styles.dateDivider}>
                                                                {new Date(msg.sent_at).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                                                            </div>
                                                        )}
                                                        <div className={`${styles.messageBubble} ${isOwn ? styles.sent : styles.received}`}>
                                                            <div className={styles.bubbleContent}>
                                                                <p>{msg.body}</p>
                                                                <span className={styles.msgTime}>
                                                                    {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <div ref={messagesEndRef} />
                                        </>
                                    )}
                                </div>

                                <footer className={styles.inputBar}>
                                    <div className={styles.inputActions}>
                                        <button title="Attach file"><Paperclip size={20} /></button>
                                        <button title="Send image"><ImageIcon size={20} /></button>
                                        <button title="Emoji"><Smile size={20} /></button>
                                    </div>
                                    <textarea
                                        className={styles.messageTextbox}
                                        placeholder="Type a message... (Enter to send)"
                                        value={messageInput}
                                        onChange={(e) => setMessageInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        rows={1}
                                    />
                                    <button
                                        className={styles.sendBtn}
                                        disabled={!messageInput.trim() || sending}
                                        onClick={handleSendMessage}
                                    >
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
                                <p>{isSeller
                                    ? 'Choose a buyer from the list to respond.'
                                    : 'Choose a chat from the left to start messaging sellers.'}</p>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
}

export default function MessagesPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
            <MessagesPageInner />
        </Suspense>
    );
}
