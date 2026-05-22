import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Wand2, Video, Music, MessageSquare } from 'lucide-react';
import { useProjects, useCreateProject } from '../hooks/useProjects';
import { useFinanceSummary } from '../hooks/useFinance';
import { KpiCard, EmptyState } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import type { CreateProjectDto } from '../../../shared/types';

const AI_TOOLS = [
  { id: 'image',  icon: <Wand2 size={20} />,         label: 'ИИ генерация изображений', desc: 'Flux-2 Pro' },
  { id: 'video',  icon: <Video size={20} />,          label: 'ИИ генерация видео',       desc: 'Kling AI' },
  { id: 'music',  icon: <Music size={20} />,          label: 'ИИ генерация музыки',      desc: 'Suno V5' },
  { id: 'chat',   icon: <MessageSquare size={20} />,  label: 'ИИ ассистент',             desc: 'GPT-4o' },
];

function CreateProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName]         = useState('');
  const [desc, setDesc]         = useState('');
  const [budget, setBudget]     = useState('');
  const createProject           = useCreateProject();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dto: CreateProjectDto = { name, description: desc };
    if (budget) dto.budget = Number(budget);
    await createProject.mutateAsync(dto);
    setName(''); setDesc(''); setBudget('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новый проект"
      footer={
        <>
          <button className="btn btn-ghost btn-sm" type="button" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary btn-sm" form="create-project-form" type="submit" disabled={createProject.isPending}>
            {createProject.isPending ? <Spinner size={12} /> : 'Создать'}
          </button>
        </>
      }
    >
      <form id="create-project-form" onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label className="form-label">Название *</label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="BAZZAR MARKET" required />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label className="form-label">Описание</label>
          <textarea className="form-input" value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="О чём этот проект..." style={{ resize: 'vertical' }} />
        </div>
        <div>
          <label className="form-label">Бюджет (₽)</label>
          <input className="form-input" type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="500000" min={0} />
        </div>
      </form>
    </Modal>
  );
}

export default function HomePage() {
  const navigate           = useNavigate();
  const { data: projects, isLoading } = useProjects();
  const { data: summary }  = useFinanceSummary();
  const [showCreate, setShowCreate] = useState(false);

  const totalBudget = projects?.reduce((s, p) => s + (p.budget ?? 0), 0) ?? 0;
  const activeCount = projects?.filter((p) => p.status === 'active').length ?? 0;

  return (
    <div style={{ padding: 32 }}>
      {/* Заголовок */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Главная</h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Обзор проектов и финансов
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} /> Новый проект
        </button>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        <KpiCard label="Активных проектов" value={activeCount} color="var(--accent)" />
        <KpiCard label="Общий бюджет" value={`${(totalBudget / 1000).toFixed(0)}к ₽`} color="var(--green)" />
        <KpiCard
          label="Оплачено"
          value={`${((summary?.paid ?? 0) / 1000).toFixed(0)}к ₽`}
          color="var(--green)"
          progress={summary?.total ? Math.round((summary.paid / summary.total) * 100) : 0}
        />
        <KpiCard
          label="Ожидает оплаты"
          value={`${((summary?.pending ?? 0) / 1000).toFixed(0)}к ₽`}
          color="var(--yellow)"
        />
      </div>

      {/* Мои проекты */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Мои проекты</h2>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-card2)', borderRadius: 20, padding: '2px 8px' }}>
            {projects?.length ?? 0}
          </span>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <Spinner size={24} />
          </div>
        ) : projects?.length === 0 ? (
          <EmptyState
            title="Нет проектов"
            message="Создайте первый проект, чтобы начать работу"
            action={
              <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
                <Plus size={14} /> Создать проект
              </button>
            }
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {projects?.map((project) => (
              <div
                key={project.id}
                className="card card-hover"
                style={{ cursor: 'pointer', borderLeft: `3px solid ${project.accent_color || 'var(--accent)'}` }}
                onClick={() => navigate(`/project/${project.id}`)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                      background: project.icon_bg || 'var(--bg-card2)',
                      color: project.icon_color || 'var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18,
                    }}
                  >
                    {project.icon || '📁'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {project.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {project.description || 'Нет описания'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <StatusBadge status={project.status as 'active' | 'archived'} />
                      {project.budget > 0 && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {(project.budget / 1000).toFixed(0)}к ₽
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Полезные программы */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Полезные программы</h2>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-card2)', borderRadius: 20, padding: '2px 8px' }}>
            ИИ инструменты
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {AI_TOOLS.map((tool) => (
            <div
              key={tool.id}
              className="card card-hover"
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
              onClick={() => navigate(`/ai-tools?tool=${tool.id}`)}
            >
              <div
                style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--accent), var(--purple, #a855f7))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff',
                }}
              >
                {tool.icon}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{tool.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{tool.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <CreateProjectModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
