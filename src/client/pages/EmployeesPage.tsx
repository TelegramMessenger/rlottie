import { useState } from 'react';
import { Search, Plus, Trash2 } from 'lucide-react';
import { useEmployees, useCreateEmployee, useDeleteEmployee } from '../hooks/useEmployees';
import { KpiCard, EmptyState } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import type { CreateEmployeeDto } from '../../../shared/types';

function AddEmployeeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState<CreateEmployeeDto>({ name: '', role: '', email: '', department: '', salary: 0 });
  const create = useCreateEmployee();

  const set = (k: keyof CreateEmployeeDto) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: k === 'salary' ? Number(e.target.value) : e.target.value }));

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    await create.mutateAsync(form);
    setForm({ name: '', role: '', email: '', department: '', salary: 0 });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новый сотрудник"
      footer={
        <>
          <button className="btn btn-ghost btn-sm" type="button" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary btn-sm" form="add-emp-form" type="submit" disabled={create.isPending}>
            {create.isPending ? <Spinner size={12} /> : 'Добавить'}
          </button>
        </>
      }
    >
      <form id="add-emp-form" onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label className="form-label">Имя *</label>
            <input className="form-input" value={form.name} onChange={set('name')} required />
          </div>
          <div>
            <label className="form-label">Должность *</label>
            <input className="form-input" value={form.role} onChange={set('role')} required />
          </div>
          <div>
            <label className="form-label">Email *</label>
            <input className="form-input" type="email" value={form.email} onChange={set('email')} required />
          </div>
          <div>
            <label className="form-label">Отдел *</label>
            <select className="form-input" value={form.department} onChange={set('department')} required>
              <option value="">Выберите...</option>
              <option value="dev">Dev</option>
              <option value="design">Design</option>
              <option value="ops">Ops</option>
              <option value="marketing">Marketing</option>
            </select>
          </div>
        </div>
        <div>
          <label className="form-label">Зарплата (₽/мес)</label>
          <input className="form-input" type="number" value={form.salary} onChange={set('salary')} min={0} />
        </div>
      </form>
    </Modal>
  );
}

export default function EmployeesPage() {
  const [q, setQ]            = useState('');
  const [dept, setDept]      = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const empParams: { q?: string; department?: string } = {};
  if (q)    empParams.q = q;
  if (dept) empParams.department = dept;
  const { data: employees = [], isLoading } = useEmployees(empParams);
  const deleteEmp = useDeleteEmployee();

  const onlineCount  = employees.filter((e) => e.is_online).length;
  const avgKpi       = employees.length ? Math.round(employees.reduce((s, e) => s + e.kpi, 0) / employees.length) : 0;
  const totalSalary  = employees.reduce((s, e) => s + e.salary, 0);

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Сотрудники</h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Управление командой</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Добавить
        </button>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KpiCard label="Всего сотрудников" value={employees.length} />
        <KpiCard label="Онлайн" value={onlineCount} color="var(--green)" />
        <KpiCard label="Средний KPI" value={`${avgKpi}%`} color="var(--accent)" progress={avgKpi} />
        <KpiCard label="ФОТ в месяц" value={`${(totalSalary / 1000).toFixed(0)}к ₽`} color="var(--yellow)" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 32 }}
            placeholder="Поиск по имени или должности..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="form-input" style={{ width: 160 }} value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">Все отделы</option>
          <option value="dev">Dev</option>
          <option value="design">Design</option>
          <option value="ops">Ops</option>
          <option value="marketing">Marketing</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spinner size={24} />
        </div>
      ) : employees.length === 0 ? (
        <EmptyState title="Нет сотрудников" message="Добавьте первого сотрудника в команду" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Отдел</th>
                <th>Статус</th>
                <th>KPI</th>
                <th>Зарплата</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: emp.avatar_bg, color: emp.avatar_color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, flexShrink: 0,
                        }}
                      >
                        {emp.avatar_initials}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{emp.role}</td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: emp.is_online ? 'var(--green)' : 'var(--border)', display: 'inline-block' }} />
                      {emp.is_online ? 'Онлайн' : 'Офлайн'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, maxWidth: 60, height: 4, borderRadius: 2, background: 'var(--border)' }}>
                        <div style={{ width: `${emp.kpi}%`, height: '100%', borderRadius: 2, background: 'var(--accent)' }} />
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emp.kpi}%</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 500 }}>{emp.salary.toLocaleString('ru')} ₽</td>
                  <td>
                    <button className="btn-icon" style={{ opacity: 0.4 }} onClick={() => deleteEmp.mutate(emp.id)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddEmployeeModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
