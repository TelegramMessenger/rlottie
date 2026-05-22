import { useState } from 'react';
import { useTasks, useUpdateTask, useDeleteTask } from '../hooks/useTasks';
import { useProjects } from '../hooks/useProjects';
import { StatusBadge, TaskTag as TaskTagBadge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import type { TaskStatus } from '../../../shared/types';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '',            label: 'Все статусы' },
  { value: 'backlog',     label: 'Бэклог' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'review',      label: 'Ревью' },
  { value: 'done',        label: 'Готово' },
];

export default function TasksPage() {
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter,  setStatusFilter]  = useState('');

  const { data: projects = [] }     = useProjects();
  const taskParams: { project_id?: string; status?: string } = {};
  if (projectFilter) taskParams.project_id = projectFilter;
  if (statusFilter)  taskParams.status     = statusFilter;
  const { data: tasks = [], isLoading } = useTasks(taskParams);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? '—';

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Задачи</h1>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Все задачи по всем проектам</div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <select className="form-input" style={{ width: 220 }} value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
          <option value="">Все проекты</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="form-input" style={{ width: 180 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spinner size={24} />
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState title="Нет задач" message="Создайте задачи внутри проекта" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Задача</th>
                <th>Проект</th>
                <th>Тег</th>
                <th>Статус</th>
                <th>Дедлайн</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{task.title}</div>
                    {task.description && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{task.description}</div>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{projectName(task.project_id)}</td>
                  <td><TaskTagBadge tag={task.tag} /></td>
                  <td><StatusBadge status={task.status as 'active' | 'archived'} /></td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {task.due_date ? new Date(task.due_date).toLocaleDateString('ru') : '—'}
                  </td>
                  <td>
                    <select
                      className="form-input"
                      style={{ fontSize: 11, padding: '2px 6px', height: 'auto', width: 'auto' }}
                      value={task.status}
                      onChange={(e) => updateTask.mutate({ id: task.id, data: { status: e.target.value as TaskStatus } })}
                    >
                      {STATUS_OPTIONS.slice(1).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
