import { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import { api } from '../api/http';
import { connectWs } from '../api/http';
import { Spinner } from '../components/ui/Spinner';
import type { Message } from '../../../shared/types';

export default function MessagesPage() {
  const { data: projects = [] } = useProjects();
  const [channel, setChannel]   = useState('general');
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [sending, setSending]   = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);

  // Load messages on channel change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get<Message[]>(`/api/messages?channel=${encodeURIComponent(channel)}`)
      .then((data) => { if (!cancelled) setMessages(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [channel]);

  // WebSocket for real-time messages
  useEffect(() => {
    const ws = connectWs((event) => {
      if (event.type === 'message:new') {
        const msg = event.payload as Message;
        if (msg.channel === channel) {
          setMessages((prev) => [...prev, msg]);
        }
      }
    });
    return () => ws.close();
  }, [channel]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.post('/api/messages', { channel, content: text });
      setText('');
    } catch {
      // Error handled silently — WS will receive the message if sent
    } finally {
      setSending(false);
    }
  };

  const channels = [
    { id: 'general',  label: '# general' },
    { id: 'design',   label: '# design' },
    { id: 'dev',      label: '# dev' },
    { id: 'ops',      label: '# ops' },
    ...projects.map((p) => ({ id: `project:${p.id}`, label: `# ${p.name.toLowerCase()}` })),
  ];

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 32px)', gap: 0 }}>
      {/* Channel sidebar */}
      <div style={{
        width: 220, flexShrink: 0,
        borderRight: '1px solid var(--border)',
        padding: '20px 12px',
        overflowY: 'auto',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, paddingLeft: 8 }}>
          Каналы
        </div>
        {channels.map((ch) => (
          <button
            key={ch.id}
            onClick={() => setChannel(ch.id)}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '6px 10px', borderRadius: 6, border: 'none',
              background: channel === ch.id ? 'var(--bg-card2)' : 'transparent',
              color: channel === ch.id ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 13, cursor: 'pointer', fontWeight: channel === ch.id ? 600 : 400,
              marginBottom: 2,
            }}
          >
            {ch.label}
          </button>
        ))}
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 600 }}>
          {channels.find((c) => c.id === channel)?.label ?? channel}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size={24} /></div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 40 }}>
              Пока нет сообщений. Напишите первым!
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} style={{ display: 'flex', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--accent)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                }}>
                  {msg.author_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{msg.author_name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(msg.created_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{
                    background: 'var(--bg-card2)', borderRadius: '0 12px 12px 12px',
                    padding: '8px 12px', fontSize: 13, lineHeight: 1.5,
                    maxWidth: 600,
                  }}>
                    {msg.content}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <input
            className="form-input"
            style={{ flex: 1 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Сообщение в ${channels.find((c) => c.id === channel)?.label ?? channel}`}
          />
          <button className="btn btn-primary" type="submit" disabled={sending || !text.trim()}>
            {sending ? <Spinner size={14} /> : <Send size={14} />}
          </button>
        </form>
      </div>
    </div>
  );
}
