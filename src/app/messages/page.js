'use client';

import BackButton from '@/components/BackButton';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { createPortal } from 'react-dom';
import {
    ChevronLeft,
    Search,
    Send,
    MoreVertical,
    Image as ImageIcon,
    Paperclip,
    Smile,
    MessageCircle,
    Trash2,
    Ban,
    X,
    Download,
    File as FileIcon
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSearchParams, useRouter } from 'next/navigation';
import styles from './page.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const POLL_INTERVAL = 5000;

const COMMON_EMOJIS = [
    '😀','😂','😍','🥰','😊','😎','🤔','😢','😅','😭',
    '👍','👎','👏','🙏','🤝','❤️','🔥','✅','⭐','💯',
    '🎉','🎊','💬','📦','💰','🛒','📸','🤣','😤','😁'
];

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

function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function MessagesPageInner() {
    const { user } = useAuth();
    const router = useRouter();
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
    const [uploading, setUploading] = useState(false);
    const [mobileShowChat, setMobileShowChat] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showOptionsMenu, setShowOptionsMenu] = useState(false);
    const [optionsMenuPos, setOptionsMenuPos] = useState({ top: 0, right: 0 });
    const [pendingAttachment, setPendingAttachment] = useState(null); // { file, previewUrl, type, name, size }
    const optionsTriggerRef = useRef(null);

    const messagesEndRef = useRef(null);
    const messageAreaRef = useRef(null);
    const pollRef = useRef(null);
    const prevMsgCount = useRef(0);
    const fileInputRef = useRef(null);
    const imageInputRef = useRef(null);
    const emojiPickerRef = useRef(null);
    const optionsMenuRef = useRef(null);

    const getToken = () => localStorage.getItem('bidpal_token');

    // Close dropdowns on outside click
    useEffect(() => {
        const handler = (e) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
                setShowEmojiPicker(false);
            }
            // options menu is fixed-position (not a DOM child of trigger), check both
            if (
                optionsMenuRef.current && !optionsMenuRef.current.contains(e.target) &&
                optionsTriggerRef.current && !optionsTriggerRef.current.contains(e.target)
            ) {
                setShowOptionsMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const isNearBottom = () => {
        const el = messageAreaRef.current;
        if (!el) return true;
        return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    };

    const scrollToBottom = (behavior = 'instant') => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    useEffect(() => {
        const prev = prevMsgCount.current;
        const curr = messages.length;
        prevMsgCount.current = curr;
        if (curr === 0) return;
        if (prev === 0) { scrollToBottom('instant'); return; }
        if (curr > prev && isNearBottom()) scrollToBottom('smooth');
    }, [messages]);

    const fetchConversations = useCallback(async (isInitial = false) => {
        try {
            const res = await fetch(`${API_URL}/api/messages`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (!res.ok) return;
            const raw = await res.json();
            const data = Array.isArray(raw) ? raw : [];
            setChats(prev => {
                if (!isInitial && prev.length === data.length) {
                    // Only re-render if unread counts or last messages differ
                    const unchanged = prev.every((c, i) =>
                        c.id === data[i]?.id &&
                        c.unreadCount === data[i]?.unreadCount &&
                        c.lastMessage === data[i]?.lastMessage
                    );
                    if (unchanged) return prev;
                }
                return data;
            });

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

    const fetchMessages = useCallback(async (convId, silent = false) => {
        if (!convId || convId.toString().startsWith('pending-')) {
            setMessages([]);
            return;
        }
        if (!silent) setMessagesLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/messages/${convId}`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (!res.ok) return;
            const incoming = await res.json();
            const data = Array.isArray(incoming) ? incoming : [];
            setMessages(prev => {
                // Skip re-render if nothing changed (same count + same last message id)
                if (
                    prev.length === data.length &&
                    (data.length === 0 || prev[prev.length - 1]?.message_id === data[data.length - 1]?.message_id)
                ) return prev;
                return data;
            });
        } catch (err) {
            console.error('Fetch messages error:', err);
        } finally {
            if (!silent) setMessagesLoading(false);
        }
    }, []);

    const markAsRead = useCallback(async (convId) => {
        if (!convId || convId.toString().startsWith('pending-')) return;
        try {
            await fetch(`${API_URL}/api/messages/${convId}/read`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            setChats(prev => prev.map(c => c.id === convId ? { ...c, unreadCount: 0 } : c));
        } catch (err) {}
    }, []);

    const sendMessageRequest = async ({ convId, receiverId, text, attachmentUrl, attachmentType, attachmentName, attachmentSize }) => {
        const isPending = convId?.toString().startsWith('pending-');
        const res = await fetch(`${API_URL}/api/messages/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({
                conversationId: isPending ? null : convId,
                receiverId: isPending ? receiverId : undefined,
                message: text || '',
                attachment_url: attachmentUrl,
                attachment_type: attachmentType,
                attachment_name: attachmentName,
                attachment_size: attachmentSize
            })
        });
        return res;
    };

    const handleSendMessage = async () => {
        const hasText = messageInput.trim();
        const hasAttachment = !!pendingAttachment;
        if (!hasText && !hasAttachment) return;
        if (!selectedChat || sending) return;
        if (!isSeller && !user?.is_verified) return;

        const msg = messageInput.trim();
        setMessageInput('');
        setSending(true);

        let attachmentUrl = null, attachmentType = null, attachmentName = null, attachmentSize = null;

        try {
            // Upload staged attachment first if present
            if (hasAttachment) {
                setUploading(true);
                const formData = new FormData();
                formData.append('file', pendingAttachment.file);
                const uploadRes = await fetch(`${API_URL}/api/messages/upload`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${getToken()}` },
                    body: formData
                });
                if (!uploadRes.ok) {
                    let errMsg = 'Upload failed';
                    try { const e = await uploadRes.json(); errMsg = e.error || errMsg; } catch {}
                    throw new Error(errMsg);
                }
                const uploaded = await uploadRes.json();
                attachmentUrl = uploaded.url;
                attachmentType = uploaded.type;
                attachmentName = uploaded.name;
                attachmentSize = uploaded.size;
                setPendingAttachment(null);
                setUploading(false);
            }

            const isPending = selectedChat.toString().startsWith('pending-');
            const res = await sendMessageRequest({
                convId: selectedChat,
                receiverId: isPending ? pendingReceiver?.id : undefined,
                text: msg,
                attachmentUrl,
                attachmentType,
                attachmentName,
                attachmentSize
            });
            if (res.ok) {
                const newMsg = await res.json();
                if (isPending) {
                    const freshData = await refreshChats();
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
            setUploading(false);
        } finally {
            setSending(false);
        }
    };

    const refreshChats = async () => {
        const freshRes = await fetch(`${API_URL}/api/messages`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const freshData = freshRes.ok ? await freshRes.json() : [];
        setChats(Array.isArray(freshData) ? freshData : []);
        return Array.isArray(freshData) ? freshData : [];
    };

    const handleFileSelect = (file) => {
        if (!file) return;
        const isImage = file.type.startsWith('image/');
        const previewUrl = isImage ? URL.createObjectURL(file) : null;
        setPendingAttachment({ file, previewUrl, type: isImage ? 'image' : 'file', name: file.name, size: file.size });
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (imageInputRef.current) imageInputRef.current.value = '';
    };

    const handleClearPendingAttachment = () => {
        if (pendingAttachment?.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl);
        setPendingAttachment(null);
    };

    const handleDeleteMessage = async (msg) => {
        try {
            const sentAt = encodeURIComponent(msg.sent_at);
            const res = await fetch(`${API_URL}/api/messages/${selectedChat}/messages/${sentAt}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (res.ok) {
                setMessages(prev => prev.filter(m => m.message_id !== msg.message_id));
            }
        } catch (err) {
            console.error('Delete message error:', err);
        }
    };

    const handleDeleteConversation = async () => {
        setShowOptionsMenu(false);
        if (!confirm('Delete this conversation? It will be removed from your inbox.')) return;
        try {
            await fetch(`${API_URL}/api/messages/${selectedChat}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            setChats(prev => prev.filter(c => c.id !== selectedChat));
            setSelectedChat(chats.find(c => c.id !== selectedChat)?.id || null);
            setMessages([]);
            setMobileShowChat(false);
        } catch (err) {
            console.error('Delete conversation error:', err);
        }
    };

    const handleBlockUser = async () => {
        const targetId = currentChat?.otherUser?.id;
        const targetName = getChatDisplayName(currentChat);
        setShowOptionsMenu(false);
        if (!targetId) return;
        if (!confirm(`Block ${targetName}? They won't be able to send you new messages.`)) return;
        try {
            await fetch(`${API_URL}/api/messages/block`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({ targetUserId: targetId })
            });
        } catch (err) {
            console.error('Block error:', err);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    useEffect(() => {
        if (user) fetchConversations(true);
    }, [user]);

    useEffect(() => {
        if (!user) return;
        pollRef.current = setInterval(() => {
            fetchConversations(false);
            if (selectedChat && !selectedChat.toString().startsWith('pending-')) {
                fetchMessages(selectedChat, true); // silent: no loading spinner on polls
            }
        }, POLL_INTERVAL);
        return () => clearInterval(pollRef.current);
    }, [user, selectedChat, fetchConversations, fetchMessages]);

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

    const getChatDisplayName = (chat) => {
        if (!chat) return '';
        if (isSeller) return chat.otherUser?.realName || chat.otherUser?.name || chat.name;
        return chat.otherUser?.storeName || chat.otherUser?.name || chat.name;
    };

    const filteredChats = chats.filter(c => {
        const displayName = getChatDisplayName(c);
        return displayName?.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const handleSelectChat = (chatId) => {
        setSelectedChat(chatId);
        markAsRead(chatId);
        setMobileShowChat(true);
        setShowOptionsMenu(false);
        setShowEmojiPicker(false);
    };

    const isPendingChat = selectedChat?.toString().startsWith('pending-');

    return (
        <div className={styles.messagesContainer}>
            {/* Hidden file inputs */}
            <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                accept="*/*"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
            />
            <input
                ref={imageInputRef}
                type="file"
                style={{ display: 'none' }}
                accept="image/*"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
            />

            <div className={styles.messagesContent}>
                <header className={styles.messagesHeader}>
                    <BackButton label="Back" />
                    <h1>{isSeller ? 'Merchant Messages' : 'My Messages'}</h1>
                </header>

                <div className={`${styles.chatWrapper} ${mobileShowChat ? styles.mobileShowChat : ''}`}>
                    {/* Sidebar */}
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
                                                    src={chat.otherUser?.avatar || chat.avatar || 'https://placehold.co/48x48?text=?'}
                                                    alt={getChatDisplayName(chat)}
                                                    onError={avatarFallback}
                                                />
                                            </div>
                                            <div className={styles.chatMeta}>
                                                <div className={styles.chatNameRow}>
                                                    <span className={styles.chatName}>{getChatDisplayName(chat)}</span>
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

                    {/* Chat Window */}
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
                                        <div
                                            className={styles.chatInfoClickable}
                                            onClick={() => {
                                                const other = currentChat.otherUser;
                                                if (!other) return;
                                                if (other.sellerId) {
                                                    router.push(`/store/${other.sellerId}`);
                                                } else {
                                                    router.push(`/profile`);
                                                }
                                            }}
                                            title="View profile"
                                        >
                                            <img
                                                src={currentChat.otherUser?.avatar || currentChat.avatar || 'https://placehold.co/36x36?text=?'}
                                                alt={getChatDisplayName(currentChat)}
                                                onError={avatarFallback}
                                            />
                                            <div className={styles.chatInfoText}>
                                                <h3>{getChatDisplayName(currentChat)}</h3>
                                                <span className={styles.chatRole}>{isSeller ? 'Buyer' : 'Seller'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.chatActions}>
                                        <button
                                            ref={optionsTriggerRef}
                                            title="Options"
                                            onClick={() => {
                                                if (optionsTriggerRef.current) {
                                                    const rect = optionsTriggerRef.current.getBoundingClientRect();
                                                    setOptionsMenuPos({
                                                        top: rect.bottom + 6,
                                                        right: window.innerWidth - rect.right
                                                    });
                                                }
                                                setShowOptionsMenu(v => !v);
                                            }}
                                        >
                                            <MoreVertical size={20} />
                                        </button>
                                    </div>
                                </header>

                                <div className={styles.messageArea} ref={messageAreaRef}>
                                    {messagesLoading ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: '#ccc', fontSize: '0.78rem' }}>
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
                                                const nextMsg = messages[i + 1];
                                                const showDate = !prevMsg ||
                                                    new Date(msg.sent_at).toDateString() !== new Date(prevMsg.sent_at).toDateString();
                                                const sameAsPrev = prevMsg && prevMsg.sender_id === msg.sender_id &&
                                                    !showDate && (new Date(msg.sent_at) - new Date(prevMsg.sent_at)) < 120000;
                                                const sameAsNext = nextMsg && nextMsg.sender_id === msg.sender_id &&
                                                    (new Date(nextMsg.sent_at) - new Date(msg.sent_at)) < 120000;
                                                const hasAttachment = msg.attachment?.url;
                                                const isImage = msg.attachment?.type === 'image';
                                                return (
                                                    <div key={msg.message_id}>
                                                        {showDate && (
                                                            <div className={styles.dateDivider}>
                                                                {new Date(msg.sent_at).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                                                            </div>
                                                        )}
                                                        <div className={`${styles.messageRow} ${isOwn ? styles.sentRow : styles.receivedRow} ${sameAsPrev ? styles.grouped : ''}`}>
                                                            {/* Side delete — only for own messages, revealed on hover */}
                                                            {isOwn && (
                                                                <button
                                                                    className={styles.msgDeleteAction}
                                                                    title="Delete message"
                                                                    onClick={() => handleDeleteMessage(msg)}
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                            <div className={`${styles.messageBubble} ${isOwn ? styles.sent : styles.received} ${sameAsPrev && isOwn ? styles.sentGrouped : ''} ${sameAsPrev && !isOwn ? styles.receivedGrouped : ''} ${sameAsNext && isOwn ? styles.sentGroupedTop : ''} ${sameAsNext && !isOwn ? styles.receivedGroupedTop : ''}`}>
                                                                <div className={styles.bubbleContent}>
                                                                    {hasAttachment && isImage && (
                                                                        <img
                                                                            src={msg.attachment.url}
                                                                            alt={msg.attachment.name || 'Image'}
                                                                            className={styles.msgImage}
                                                                            onClick={() => window.open(msg.attachment.url, '_blank')}
                                                                        />
                                                                    )}
                                                                    {hasAttachment && !isImage && (
                                                                        <a
                                                                            href={msg.attachment.url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className={styles.msgFile}
                                                                        >
                                                                            <Download size={14} />
                                                                            <span className={styles.msgFileName}>{msg.attachment.name || 'Attachment'}</span>
                                                                            {msg.attachment.size > 0 && (
                                                                                <span className={styles.msgFileSize}>{formatFileSize(msg.attachment.size)}</span>
                                                                            )}
                                                                        </a>
                                                                    )}
                                                                    {msg.body && <p>{msg.body}</p>}
                                                                    <span className={styles.msgTime}>
                                                                        {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <div ref={messagesEndRef} />
                                        </>
                                    )}
                                </div>

                                {!isSeller && !user?.is_verified ? (
                                    <footer className={styles.inputBar} style={{ justifyContent: 'center', padding: '12px 16px', background: '#fff7ed', borderTop: '1px solid #fed7aa' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem', color: '#9a3412' }}>
                                            <span style={{ fontSize: '1rem' }}>🔒</span>
                                            <span>Verify your ID to send messages.</span>
                                            <a href="/buyer/setup" style={{ fontWeight: 700, color: '#ea580c', textDecoration: 'none', whiteSpace: 'nowrap' }}>Verify Now →</a>
                                        </div>
                                    </footer>
                                ) : (
                                    <footer className={styles.inputFooter}>
                                        {/* Staged attachment preview */}
                                        {pendingAttachment && (
                                            <div className={styles.pendingAttachmentBar}>
                                                {pendingAttachment.type === 'image' ? (
                                                    <img
                                                        src={pendingAttachment.previewUrl}
                                                        alt={pendingAttachment.name}
                                                        className={styles.pendingAttachmentThumb}
                                                    />
                                                ) : (
                                                    <div className={styles.pendingAttachmentIcon}>
                                                        <FileIcon size={22} />
                                                    </div>
                                                )}
                                                <div className={styles.pendingAttachmentInfo}>
                                                    <div className={styles.pendingAttachmentName}>{pendingAttachment.name}</div>
                                                    <div className={styles.pendingAttachmentSize}>{formatFileSize(pendingAttachment.size)}</div>
                                                </div>
                                                <button
                                                    className={styles.pendingAttachmentRemove}
                                                    onClick={handleClearPendingAttachment}
                                                    title="Remove attachment"
                                                >
                                                    <X size={13} />
                                                </button>
                                            </div>
                                        )}
                                        <div className={styles.inputBar}>
                                            <div className={styles.inputActions}>
                                                <button
                                                    title="Attach file"
                                                    disabled={uploading}
                                                    onClick={() => fileInputRef.current?.click()}
                                                >
                                                    <Paperclip size={20} />
                                                </button>
                                                <button
                                                    title="Send image"
                                                    disabled={uploading}
                                                    onClick={() => imageInputRef.current?.click()}
                                                >
                                                    <ImageIcon size={20} />
                                                </button>
                                                <div className={styles.emojiWrapper} ref={emojiPickerRef}>
                                                    <button
                                                        title="Emoji"
                                                        onClick={() => setShowEmojiPicker(v => !v)}
                                                    >
                                                        <Smile size={20} />
                                                    </button>
                                                    {showEmojiPicker && (
                                                        <div className={styles.emojiPicker}>
                                                            {COMMON_EMOJIS.map(emoji => (
                                                                <button
                                                                    key={emoji}
                                                                    className={styles.emojiBtn}
                                                                    onClick={() => {
                                                                        setMessageInput(prev => prev + emoji);
                                                                        setShowEmojiPicker(false);
                                                                    }}
                                                                >
                                                                    {emoji}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <textarea
                                                className={styles.messageTextbox}
                                                placeholder={uploading ? 'Uploading…' : 'Type a message…'}
                                                value={messageInput}
                                                onChange={(e) => setMessageInput(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                rows={1}
                                                disabled={uploading}
                                            />
                                            <button
                                                className={styles.sendBtn}
                                                disabled={(!messageInput.trim() && !pendingAttachment) || sending || uploading}
                                                onClick={handleSendMessage}
                                            >
                                                <Send size={18} />
                                            </button>
                                        </div>
                                    </footer>
                                )}
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

            {/* Options menu rendered via portal — escapes ALL ancestor overflow/clip contexts */}
            {showOptionsMenu && !isPendingChat && createPortal(
                <div
                    ref={optionsMenuRef}
                    className={styles.optionsMenu}
                    style={{ top: optionsMenuPos.top, right: optionsMenuPos.right }}
                >
                    <button
                        className={`${styles.optionsItem} ${styles.optionsDanger}`}
                        onClick={handleBlockUser}
                    >
                        <Ban size={15} />
                        Block {isSeller ? 'Buyer' : 'Seller'}
                    </button>
                    <button
                        className={`${styles.optionsItem} ${styles.optionsDanger}`}
                        onClick={handleDeleteConversation}
                    >
                        <Trash2 size={15} />
                        Delete Conversation
                    </button>
                </div>,
                document.body
            )}
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
