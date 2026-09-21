'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, getStoredAuth } from '@/lib/auth';
import { formatDate } from '@/components/admin-ui';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'user' | 'provider';
  content: string;
  isRead: boolean;
  createdAt: string;
}

interface Conversation {
  id: string;
  reservation: {
    id: string; reservationCode: string;
    service: { id: string; title: string };
  };
}

interface PaginatedMessages { items: Message[]; meta: { page: number; totalPages: number } }

export default function ConversationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const conversationId = params.id;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  async function loadMessages() {
    const r = await apiFetch<PaginatedMessages>(`/api/conversations/${conversationId}/messages?limit=100`);
    if (r.success && r.data) {
      setMessages(r.data.items || []);
      scrollToBottom();
    }
  }

  useEffect(() => {
    const auth = getStoredAuth();
    if (!auth.accessToken) {
      router.replace(`/login?next=/mesajlar/${conversationId}`);
      return;
    }
    Promise.all([
      apiFetch<{ items: Conversation[] }>(`/api/conversations?limit=50`),
      loadMessages(),
    ]).then(([convRes]) => {
      if (convRes.success && convRes.data) {
        const found = convRes.data.items?.find((c: any) => c.id === conversationId);
        if (found) setConversation(found);
      }
      setLoading(false);
    });

    // Mark as read
    apiFetch(`/api/conversations/${conversationId}/read`, { method: 'POST' });
  }, [conversationId, router]);

  async function sendMessage() {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');

    // Optimistik — mesajı hemen ekle
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      conversationId,
      senderId: 'me',
      senderType: 'user',
      content,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom();

    const r = await apiFetch(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });

    if (r.success && r.data) {
      // Optimistik mesajı gerçek mesajla değiştir
      setMessages((prev) => prev.map((m) => m.id === tempId ? r.data : m));
    } else {
      // Hata — optimistiği kaldır
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError(r.message || 'Mesaj gönderilemedi');
    }
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>Yükleniyor...</div>;

  return (
    <div style={{ minHeight: '100vh', maxWidth: 800, margin: '0 auto', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: 'white', borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Link href="/mesajlar" style={{ fontSize: '0.85rem', color: '#0ea5e9', textDecoration: 'none' }}>← Mesajlar</Link>
        {conversation && (
          <>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0.5rem 0 0.25rem' }}>
              {conversation.reservation.service.title}
            </h1>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Rezervasyon: <code style={{ fontSize: '0.8rem' }}>{conversation.reservation.reservationCode}</code>
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, background: 'white', borderRadius: 8, padding: '1rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)',
        display: 'flex', flexDirection: 'column', gap: '0.5rem',
      }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
            Henüz mesaj yok. İlk mesajı gönderin!
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                alignSelf: msg.senderType === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '70%',
              }}
            >
              <div style={{
                background: msg.senderType === 'user' ? '#0ea5e9' : '#f1f5f9',
                color: msg.senderType === 'user' ? 'white' : '#0f172a',
                padding: '0.6rem 1rem',
                borderRadius: msg.senderType === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                fontSize: '0.9rem',
                lineHeight: 1.4,
              }}>
                {msg.content}
              </div>
              <div style={{
                fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.25rem',
                textAlign: msg.senderType === 'user' ? 'right' : 'left',
              }}>
                {formatDate(msg.createdAt)}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {error && <div style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '0.5rem' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Mesajınızı yazın... (Enter ile gönder)"
          rows={2}
          style={{
            flex: 1, padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: 8,
            fontSize: '0.9rem', resize: 'none', fontFamily: 'inherit',
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!newMessage.trim() || sending}
          style={{
            padding: '0.75rem 1.5rem', background: newMessage.trim() ? '#0ea5e9' : '#94a3b8',
            color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
            fontWeight: 600, fontSize: '0.9rem',
          }}
        >
          {sending ? '...' : 'Gönder'}
        </button>
      </div>
    </div>
  );
}
