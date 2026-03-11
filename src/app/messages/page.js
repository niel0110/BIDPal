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

const buyerChats = [
    {
        id: 1,
        name: 'RetroVault',
        lastMessage: 'The camera is in perfect condition!',
        time: '10:24 AM',
        unread: 2,
        online: true,
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Retro'
    },
    {
        id: 2,
        name: 'EleganceCo',
        lastMessage: 'Sure, I can ship it today.',
        time: 'Yesterday',
        unread: 0,
        online: false,
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Elegance'
    }
];

const sellerChats = [];

const buyerMessages = [
    { id: 1, text: 'Hi! I saw your post about the analog camera.', sender: 'me', time: '10:15 AM' },
    { id: 2, text: 'Hello! Yes, it is still available.', sender: 'them', time: '10:17 AM' },
    { id: 3, text: 'Does it come with the original lens cap?', sender: 'me', time: '10:18 AM' },
    { id: 4, text: 'The camera is in perfect condition! And yes, the lens cap is included.', sender: 'them', time: '10:24 AM' },
];

const sellerMessages = [];

export default function MessagesPage() {
    const router = useRouter();
    const { user } = useAuth();
    const isSeller = user?.role?.toLowerCase() === 'seller';

    const chats = isSeller ? sellerChats : buyerChats;
    const [selectedChat, setSelectedChat] = useState(chats[0]?.id);
    const [messageInput, setMessageInput] = useState('');

    const currentChat = chats.find(c => c.id === selectedChat);
    const messages = isSeller ? sellerMessages : buyerMessages;

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
                                    <div className={styles.dateDivider}>Today</div>
                                    {messages.map(msg => (
                                        <div key={msg.id} className={`${styles.messageBubble} ${msg.sender === 'me' ? styles.sent : styles.received}`}>
                                            <div className={styles.bubbleContent}>
                                                <p>{msg.text}</p>
                                                <span className={styles.msgTime}>{msg.time}</span>
                                            </div>
                                        </div>
                                    ))}
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
                                    <button className={styles.sendBtn} disabled={!messageInput.trim()}>
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
