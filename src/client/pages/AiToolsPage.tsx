import { useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { create } from 'zustand';
import { Send, Download, Wand2, Video, Music, MessageSquare, RefreshCw } from 'lucide-react';
import { useGenerateImage, useGenerateVideo, useGenerateMusic, useAiChat, useAiJob } from '../hooks/useAiJob';
import { Spinner, TypingDots } from '../components/ui/Spinner';
import type { KieChatMessage } from '../../../shared/types';

// ── Постоянное состояние инструментов ──────────────────────────────
// Хранится в Zustand, чтобы переключение вкладок не сбрасывало введённый
// промпт и текущий jobId. Сохраняется на время сессии (не в localStorage).

interface ToolsState {
  image: { prompt: string; jobId: string | null; width: number; height: number };
  video: { prompt: string; jobId: string | null; duration: 5 | 10; ratio: '16:9' | '9:16' | '1:1' };
  music: { prompt: string; jobId: string | null; style: string; instrumental: boolean };
  chat:  { messages: KieChatMessage[]; input: string };
  set:   <K extends 'image' | 'video' | 'music' | 'chat'>(tool: K, patch: Partial<ToolsState[K]>) => void;
}

const useToolsStore = create<ToolsState>((set) => ({
  image: { prompt: '', jobId: null, width: 1024, height: 1024 },
  video: { prompt: '', jobId: null, duration: 5, ratio: '16:9' },
  music: { prompt: '', jobId: null, style: '', instrumental: false },
  chat:  { messages: [], input: '' },
  set:   (tool, patch) => set((s) => ({ ...s, [tool]: { ...s[tool], ...patch } })),
}));

// ── Image tool ──────────────────────────────────────────────────────

function ImageTool() {
  const state    = useToolsStore((s) => s.image);
  const update   = useToolsStore((s) => s.set);
  const generate = useGenerateImage();
  const { data: job } = useAiJob(state.jobId);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await generate.mutateAsync({ prompt: state.prompt, width: state.width, height: state.height });
    update('image', { jobId: result.id });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, height: '100%' }}>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Генерация изображения</h3>
        <form onSubmit={handleGenerate}>
          <div style={{ marginBottom: 12 }}>
            <label className="form-label">Промпт *</label>
            <textarea
              className="form-input"
              value={state.prompt}
              onChange={(e) => update('image', { prompt: e.target.value })}
              rows={4}
              placeholder="A futuristic city at night with neon lights, cyberpunk style..."
              style={{ resize: 'vertical' }}
              required
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label className="form-label">Ширина (px)</label>
              <select className="form-input" value={state.width} onChange={(e) => update('image', { width: Number(e.target.value) })}>
                <option value={512}>512</option>
                <option value={768}>768</option>
                <option value={1024}>1024</option>
                <option value={1280}>1280</option>
              </select>
            </div>
            <div>
              <label className="form-label">Высота (px)</label>
              <select className="form-input" value={state.height} onChange={(e) => update('image', { height: Number(e.target.value) })}>
                <option value={512}>512</option>
                <option value={768}>768</option>
                <option value={1024}>1024</option>
                <option value={1280}>1280</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={generate.isPending} style={{ width: '100%' }}>
            {generate.isPending ? <><Spinner size={14} /> Запускаю...</> : <><Wand2 size={14} /> Сгенерировать</>}
          </button>
        </form>

        {state.jobId && (
          <div style={{ marginTop: 16 }}>
            <JobStatus jobId={state.jobId} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {job?.status === 'success' && job.result_url ? (
          <div style={{ textAlign: 'center' }}>
            <img
              src={job.result_url}
              alt="AI generated"
              style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 12, border: '1px solid var(--border)' }}
            />
            <div style={{ marginTop: 12 }}>
              <a href={job.result_url} download className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer">
                <Download size={14} /> Скачать
              </a>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <Wand2 size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
            <div style={{ fontSize: 13 }}>Результат появится здесь</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Video tool ──────────────────────────────────────────────────────

function VideoTool() {
  const state    = useToolsStore((s) => s.video);
  const update   = useToolsStore((s) => s.set);
  const generate = useGenerateVideo();
  const { data: job } = useAiJob(state.jobId);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await generate.mutateAsync({ prompt: state.prompt, duration: state.duration, ratio: state.ratio });
    update('video', { jobId: result.id });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, height: '100%' }}>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Генерация видео (Kling AI)</h3>
        <form onSubmit={handleGenerate}>
          <div style={{ marginBottom: 12 }}>
            <label className="form-label">Промпт *</label>
            <textarea
              className="form-input"
              value={state.prompt}
              onChange={(e) => update('video', { prompt: e.target.value })}
              rows={4}
              placeholder="A drone shot of mountain landscape at sunset..."
              style={{ resize: 'vertical' }}
              required
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label className="form-label">Длительность</label>
              <select className="form-input" value={state.duration} onChange={(e) => update('video', { duration: Number(e.target.value) as 5 | 10 })}>
                <option value={5}>5 сек</option>
                <option value={10}>10 сек</option>
              </select>
            </div>
            <div>
              <label className="form-label">Соотношение сторон</label>
              <select className="form-input" value={state.ratio} onChange={(e) => update('video', { ratio: e.target.value as '16:9' | '9:16' | '1:1' })}>
                <option value="16:9">16:9 (горизонталь)</option>
                <option value="9:16">9:16 (вертикаль)</option>
                <option value="1:1">1:1 (квадрат)</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={generate.isPending} style={{ width: '100%' }}>
            {generate.isPending ? <><Spinner size={14} /> Запускаю...</> : <><Video size={14} /> Сгенерировать</>}
          </button>
        </form>

        {state.jobId && (
          <div style={{ marginTop: 16 }}>
            <JobStatus jobId={state.jobId} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {job?.status === 'success' && job.result_url ? (
          <div style={{ textAlign: 'center' }}>
            <video
              src={job.result_url}
              controls
              style={{ maxWidth: '100%', maxHeight: 350, borderRadius: 12, border: '1px solid var(--border)' }}
            />
            <div style={{ marginTop: 12 }}>
              <a href={job.result_url} download className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer">
                <Download size={14} /> Скачать
              </a>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <Video size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
            <div style={{ fontSize: 13 }}>Результат появится здесь</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Music tool ──────────────────────────────────────────────────────

function MusicTool() {
  const state    = useToolsStore((s) => s.music);
  const update   = useToolsStore((s) => s.set);
  const generate = useGenerateMusic();
  const { data: job } = useAiJob(state.jobId);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const musicReq: Parameters<typeof generate.mutateAsync>[0] = { prompt: state.prompt, instrumental: state.instrumental, model: 'V5' };
    if (state.style) musicReq.style = state.style;
    const result = await generate.mutateAsync(musicReq);
    update('music', { jobId: result.id });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Генерация музыки (Suno V5)</h3>
        <form onSubmit={handleGenerate}>
          <div style={{ marginBottom: 12 }}>
            <label className="form-label">Описание музыки *</label>
            <textarea
              className="form-input"
              value={state.prompt}
              onChange={(e) => update('music', { prompt: e.target.value })}
              rows={3}
              placeholder="Energetic electronic music with heavy bass for a product launch video..."
              style={{ resize: 'vertical' }}
              required
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="form-label">Стиль (опционально)</label>
            <input
              className="form-input"
              value={state.style}
              onChange={(e) => update('music', { style: e.target.value })}
              placeholder="electronic, hip-hop, cinematic..."
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <input
              type="checkbox"
              id="instrumental"
              checked={state.instrumental}
              onChange={(e) => update('music', { instrumental: e.target.checked })}
            />
            <label htmlFor="instrumental" style={{ fontSize: 13, cursor: 'pointer' }}>
              Инструментальная (без вокала)
            </label>
          </div>
          <button className="btn btn-primary" type="submit" disabled={generate.isPending} style={{ width: '100%' }}>
            {generate.isPending ? <><Spinner size={14} /> Запускаю...</> : <><Music size={14} /> Сгенерировать</>}
          </button>
        </form>

        {state.jobId && (
          <div style={{ marginTop: 16 }}>
            <JobStatus jobId={state.jobId} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {job?.status === 'success' && job.result_url ? (
          <div style={{ textAlign: 'center', width: '100%' }}>
            <audio
              src={job.result_url}
              controls
              style={{ width: '100%', marginBottom: 12 }}
            />
            <a href={job.result_url} download className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer">
              <Download size={14} /> Скачать
            </a>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <Music size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
            <div style={{ fontSize: 13 }}>Результат появится здесь</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chat tool ───────────────────────────────────────────────────────

function ChatTool() {
  const state  = useToolsStore((s) => s.chat);
  const update = useToolsStore((s) => s.set);
  const chat   = useAiChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages, chat.isPending]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.input.trim()) return;
    const userMsg: KieChatMessage = { role: 'user', content: state.input };
    const updatedMessages = [...state.messages, userMsg];
    update('chat', { messages: updatedMessages, input: '' });
    try {
      const result = await chat.mutateAsync({ messages: updatedMessages });
      update('chat', { messages: [...updatedMessages, { role: 'assistant', content: result.content }] });
    } catch {
      update('chat', { messages: [...updatedMessages, { role: 'assistant', content: '⚠️ Ошибка при получении ответа. Попробуйте ещё раз.' }] });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, flexShrink: 0 }}>ИИ Ассистент</h3>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16, paddingRight: 4 }}>
        {state.messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>
            <MessageSquare size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
            <div style={{ fontSize: 13 }}>Задайте вопрос ИИ ассистенту</div>
          </div>
        ) : (
          state.messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '75%', padding: '10px 14px', borderRadius: 12,
                  fontSize: 13, lineHeight: 1.6,
                  background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-card2)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                  borderBottomRightRadius: msg.role === 'user' ? 4 : 12,
                  borderBottomLeftRadius:  msg.role === 'assistant' ? 4 : 12,
                }}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
        {chat.isPending && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <TypingDots />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <input
          className="form-input"
          style={{ flex: 1 }}
          value={state.input}
          onChange={(e) => update('chat', { input: e.target.value })}
          placeholder="Спросите что-нибудь..."
          disabled={chat.isPending}
        />
        <button className="btn btn-primary" type="submit" disabled={chat.isPending || !state.input.trim()}>
          {chat.isPending ? <Spinner size={14} /> : <Send size={14} />}
        </button>
        {state.messages.length > 0 && (
          <button className="btn btn-ghost" type="button" title="Очистить" onClick={() => update('chat', { messages: [] })}>
            <RefreshCw size={14} />
          </button>
        )}
      </form>
    </div>
  );
}

// ── Job status badge ────────────────────────────────────────────────

function JobStatus({ jobId }: { jobId: string }) {
  const { data: job } = useAiJob(jobId);
  if (!job) return null;

  const statusConfig: Record<string, { label: string; color: string }> = {
    queued:     { label: 'В очереди...',   color: 'var(--text-muted)' },
    processing: { label: 'Генерируется...', color: 'var(--accent)' },
    success:    { label: 'Готово!',        color: 'var(--green)' },
    failed:     { label: 'Ошибка',         color: 'var(--red, #f87171)' },
  };

  const cfg = statusConfig[job.status] ?? { label: job.status, color: 'var(--text-muted)' };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: cfg.color }}>
      {(job.status === 'queued' || job.status === 'processing') && <Spinner size={12} />}
      {cfg.label}
      {job.error && <span style={{ color: 'var(--red, #f87171)' }}> — {job.error}</span>}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────

const TOOLS = [
  { id: 'image', label: 'Изображения', icon: <Wand2 size={16} /> },
  { id: 'video', label: 'Видео',       icon: <Video size={16} /> },
  { id: 'music', label: 'Музыка',      icon: <Music size={16} /> },
  { id: 'chat',  label: 'Чат',         icon: <MessageSquare size={16} /> },
];

export default function AiToolsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTool = searchParams.get('tool') ?? 'image';
  const setTool = (id: string) => setSearchParams({ tool: id });

  // Используем display:none вместо conditional rendering, чтобы DOM сохранялся
  // (страховка на случай, если zustand не справится с быстрым переключением).
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 32px)', gap: 0 }}>
      <div style={{
        width: 180, flexShrink: 0,
        borderRight: '1px solid var(--border)',
        padding: '20px 12px',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, paddingLeft: 8 }}>
          ИИ Инструменты
        </div>
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setTool(tool.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 10px', borderRadius: 6, border: 'none',
              background: activeTool === tool.id ? 'var(--bg-card2)' : 'transparent',
              color: activeTool === tool.id ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: 13, cursor: 'pointer', fontWeight: activeTool === tool.id ? 600 : 400,
              marginBottom: 2,
            }}
          >
            {tool.icon}
            {tool.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: activeTool === 'image' ? 'block' : 'none', height: '100%' }}><ImageTool /></div>
        <div style={{ display: activeTool === 'video' ? 'block' : 'none', height: '100%' }}><VideoTool /></div>
        <div style={{ display: activeTool === 'music' ? 'block' : 'none', height: '100%' }}><MusicTool /></div>
        <div style={{ display: activeTool === 'chat'  ? 'flex'  : 'none', flexDirection: 'column', height: '100%', minHeight: 0 }}><ChatTool /></div>
      </div>
    </div>
  );
}
