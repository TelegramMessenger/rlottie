import { useProjects } from '../hooks/useProjects';
import { useEmployees } from '../hooks/useEmployees';
import { useFinanceSummary } from '../hooks/useFinance';
import { useTasks } from '../hooks/useTasks';
import { KpiCard } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';

export default function AnalyticsPage() {
  const { data: projects = [], isLoading: projLoading } = useProjects();
  const { data: employees = [] }  = useEmployees();
  const { data: summary }         = useFinanceSummary();
  const { data: tasks = [] }      = useTasks();

  const activeProjects  = projects.filter((p) => p.status === 'active').length;
  const doneTasks       = tasks.filter((t) => t.status === 'done').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
  const avgKpi          = employees.length ? Math.round(employees.reduce((s, e) => s + e.kpi, 0) / employees.length) : 0;
  const onlineCount     = employees.filter((e) => e.is_online).length;

  if (projLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <Spinner size={28} />
      </div>
    );
  }

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Аналитика</h1>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Сводный дашборд по всем метрикам</div>
      </div>

      {/* Main KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        <KpiCard label="Активных проектов" value={activeProjects} color="var(--accent)" progress={projects.length ? Math.round(activeProjects / projects.length * 100) : 0} />
        <KpiCard label="Задач выполнено" value={doneTasks} color="var(--green)" progress={tasks.length ? Math.round(doneTasks / tasks.length * 100) : 0} />
        <KpiCard label="В работе" value={inProgressTasks} color="var(--yellow)" />
        <KpiCard label="Средний KPI" value={`${avgKpi}%`} color="var(--accent)" progress={avgKpi} />
        <KpiCard label="Онлайн сейчас" value={`${onlineCount}/${employees.length}`} color="var(--green)" />
        <KpiCard label="Оборот" value={`${((summary?.total ?? 0) / 1000).toFixed(0)}к ₽`} color="var(--purple, #a855f7)" />
        <KpiCard label="Оплачено" value={`${((summary?.paid ?? 0) / 1000).toFixed(0)}к ₽`} color="var(--green)"
          progress={summary?.total ? Math.round((summary.paid / summary.total) * 100) : 0} />
        <KpiCard label="Ожидает оплаты" value={`${((summary?.pending ?? 0) / 1000).toFixed(0)}к ₽`} color="var(--yellow)" />
      </div>

      {/* Projects breakdown */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Проекты</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {projects.map((project) => {
            const projectTasks = tasks.filter((t) => t.project_id === project.id);
            const done = projectTasks.filter((t) => t.status === 'done').length;
            const pct  = projectTasks.length ? Math.round(done / projectTasks.length * 100) : 0;

            return (
              <div key={project.id} className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      background: project.icon_bg || 'var(--bg-card2)',
                      color: project.icon_color || 'var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                    }}
                  >
                    {project.icon || '📁'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{project.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{done}/{projectTasks.length} задач</span>
                        <StatusBadge status={project.status as 'active' | 'archived'} />
                      </div>
                    </div>
                    {projectTasks.length > 0 && (
                      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}>
                        <div
                          style={{
                            width: `${pct}%`, height: '100%', borderRadius: 3,
                            background: project.accent_color || 'var(--accent)',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', width: 40, textAlign: 'right' }}>
                    {pct}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Team performance */}
      <section>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Производительность команды</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {employees
            .slice()
            .sort((a, b) => b.kpi - a.kpi)
            .map((emp) => (
              <div key={emp.id} className="card" style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: emp.avatar_bg, color: emp.avatar_color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}
                  >
                    {emp.avatar_initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{emp.role}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: emp.kpi >= 80 ? 'var(--green)' : emp.kpi >= 50 ? 'var(--yellow)' : 'var(--red, #f87171)' }}>
                    {emp.kpi}%
                  </span>
                </div>
                <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}>
                  <div
                    style={{
                      width: `${emp.kpi}%`, height: '100%', borderRadius: 2,
                      background: emp.kpi >= 80 ? 'var(--green)' : emp.kpi >= 50 ? 'var(--yellow)' : 'var(--red, #f87171)',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
