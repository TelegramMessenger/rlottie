import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useProject } from '../hooks/useProjects';
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from '../hooks/useTasks';
import { StatusBadge, TaskTag as TaskTagBadge } from '../components/ui/Badge';
import { KpiCard, EmptyState } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import type { Task, TaskStatus, CreateTaskDto } from '../../../shared/types';

const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: 'backlog',     label: 'Бэклог' },
  { key: 'in_progress', label: 'В работе' },
  { key: 'review',      label: 'Ревью' },
  { key: 'done',        label: 'Готово' },
];

function TaskCard({ task, onDelete }: { task: Task; onDelete: (id: string) => void }) {
  const updateTask = useUpdateTask();

  const moveTask = (status: TaskStatus) => {
    updateTask.mutate({ id: task.id, data: { status } });
  };

  return (
    <div className="card" style={{ marginBottom: 8, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{task.title}</div>
          {task.description && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{task.description}</div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <TaskTagBadge tag={task.tag} />
            {task.due_date && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                до {new Date(task.due_date).toLocaleDateString('ru')}
              </span>
            )}
          </div>
        </div>
        <button
          className="btn-icon"
          style={{ flexShrink: 0, opacity: 0.4 }}
          onClick={() => onDelete(task.id)}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Move controls */}
      <div style={{ display: 'flex', gap: 4, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        {COLUMNS.filter((c) => c.key !== task.status).map((col) => (
          <button
            key={col.key}
            className="btn btn-ghost"
            style={{ fontSize: 10, padding: '2px 6px', height: 'auto' }}
            onClick={() => moveTask(col.key)}
          >
            → {col.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AddTaskModal({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId: string }) {
  const [title, setTitle]   = useState('');
  const [desc, setDesc]     = useState('');
  const [tag, setTag]       = useState('dev');
  const [status, setStatus] = useState<TaskStatus>('backlog');
  const createTask          = useCreateTask();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dto: CreateTaskDto = { project_id: projectId, title };
    if (desc)   dto.description = desc;
    if (tag)    dto.tag         = tag as import('../../../shared/types').TaskTag;
    if (status) dto.status      = status;
    await createTask.mutateAsync(dto);
    setTitle(''); setDesc(''); setTag('dev'); setStatus('backlog');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новая задача"
      footer={
        <>
          <button className="btn btn-ghost btn-sm" type="button" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary btn-sm" form="add-task-form" type="submit" disabled={createTask.isPending}>
            {createTask.isPending ? <Spinner size={12} /> : 'Добавить'}
          </button>
        </>
      }
    >
      <form id="add-task-form" onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label className="form-label">Название *</label>
          <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label className="form-label">Описание</label>
          <textarea className="form-input" value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} style={{ resize: 'vertical' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="form-label">Тег</label>
            <select className="form-input" value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="dev">Dev</option>
              <option value="design">Design</option>
              <option value="ops">Ops</option>
              <option value="bug">Баг</option>
              <option value="marketing">Маркетинг</option>
            </select>
          </div>
          <div>
            <label className="form-label">Статус</label>
            <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default function ProjectPage() {
  const { id = '' }             = useParams<{ id: string }>();
  const navigate                = useNavigate();
  const { data: project, isLoading } = useProject(id);
  const { data: tasks = [] }    = useTasks({ project_id: id });
  const deleteTask              = useDeleteTask();
  const [showAddTask, setShowAddTask] = useState(false);
  const [activeTab, setActiveTab] = useState<'board' | 'finance' | 'team'>('board');

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <Spinner size={28} />
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ padding: 32 }}>
        <EmptyState title="Проект не найден" />
      </div>
    );
  }

  const tasksByStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status);
  const donePct = tasks.length ? Math.round((tasksByStatus('done').length / tasks.length) * 100) : 0;

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button className="btn-icon" onClick={() => navigate('/')}>
          <ArrowLeft size={16} />
        </button>
        <div
          style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: project.icon_bg || 'var(--bg-card2)',
            color: project.icon_color || 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}
        >
          {project.icon || '📁'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{project.name}</h1>
            <StatusBadge status={project.status as 'active' | 'archived'} />
          </div>
          {project.description && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{project.description}</div>
          )}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAddTask(true)}>
          <Plus size={14} /> Задача
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KpiCard label="Задач всего" value={tasks.length} />
        <KpiCard label="В работе" value={tasksByStatus('in_progress').length} color="var(--accent)" />
        <KpiCard label="Готово" value={`${donePct}%`} color="var(--green)" progress={donePct} />
        {project.budget > 0 && (
          <KpiCard label="Бюджет" value={`${(project.budget / 1000).toFixed(0)}к ₽`} color="var(--purple, #a855f7)" />
        )}
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        {(['board', 'finance', 'team'] as const).map((tab) => (
          <button
            key={tab}
            className={`tab${activeTab === tab ? ' tab-active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {{ board: 'Доска', finance: 'Финансы', team: 'Команда' }[tab]}
          </button>
        ))}
      </div>

      {/* Kanban board */}
      {activeTab === 'board' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {COLUMNS.map(({ key, label }) => (
            <div key={key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
                <span style={{
                  fontSize: 10, background: 'var(--bg-card2)', borderRadius: 20,
                  padding: '1px 7px', color: 'var(--text-muted)',
                }}>
                  {tasksByStatus(key).length}
                </span>
              </div>
              <div style={{ minHeight: 80 }}>
                {tasksByStatus(key).map((task) => (
                  <TaskCard key={task.id} task={task} onDelete={(tid) => deleteTask.mutate(tid)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Finance tab */}
      {activeTab === 'finance' && (
        <div>
          {(project as { finance?: { id: string; description: string; amount: number; status: string; category: string; date: string }[] }).finance?.length === 0 ? (
            <EmptyState title="Нет финансовых записей" message="Добавьте расходы или доходы для этого проекта" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Описание</th>
                    <th>Категория</th>
                    <th>Сумма</th>
                    <th>Статус</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {(project as { finance?: { id: string; description: string; amount: number; status: string; category: string; date: string }[] }).finance?.map((rec) => (
                    <tr key={rec.id}>
                      <td>{rec.description}</td>
                      <td><TaskTagBadge tag={rec.category} /></td>
                      <td style={{ fontWeight: 600 }}>{rec.amount.toLocaleString('ru')} ₽</td>
                      <td><StatusBadge status={rec.status as 'paid' | 'pending' | 'cancelled'} /></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(rec.date).toLocaleDateString('ru')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Team tab */}
      {activeTab === 'team' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {(project as { team?: { id: string; name: string; role: string; avatar_initials: string; avatar_bg: string; avatar_color: string; kpi: number; is_online: boolean }[] }).team?.map((member) => (
            <div key={member.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: member.avatar_bg, color: member.avatar_color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700,
                }}
              >
                {member.avatar_initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{member.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{member.role}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>KPI: {member.kpi}%</div>
              </div>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: member.is_online ? 'var(--green)' : 'var(--border)', flexShrink: 0 }} />
            </div>
          ))}
          {!(project as { team?: unknown[] }).team?.length && (
            <EmptyState title="Нет участников" message="Добавьте сотрудников в проект" />
          )}
        </div>
      )}

      <AddTaskModal open={showAddTask} onClose={() => setShowAddTask(false)} projectId={id} />
    </div>
  );
}
