import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useFinance, useFinanceSummary, useCreateFinanceRecord, useDeleteFinanceRecord } from '../hooks/useFinance';
import { useProjects } from '../hooks/useProjects';
import { KpiCard, EmptyState } from '../components/ui/Card';
import { StatusBadge, TaskTag as TaskTagBadge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import type { CreateFinanceRecordDto, FinanceStatus } from '../../../shared/types';

function AddRecordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: projects = [] } = useProjects();
  const create = useCreateFinanceRecord();
  const [form, setForm] = useState<Partial<CreateFinanceRecordDto>>({ description: '', category: 'dev', amount: 0, status: 'pending' });

  const set = (k: keyof CreateFinanceRecordDto) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: k === 'amount' ? Number(e.target.value) : e.target.value }));

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    await create.mutateAsync(form as CreateFinanceRecordDto);
    setForm({ description: '', category: 'dev', amount: 0, status: 'pending' });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новая запись"
      footer={
        <>
          <button className="btn btn-ghost btn-sm" type="button" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary btn-sm" form="add-fin-form" type="submit" disabled={create.isPending}>
            {create.isPending ? <Spinner size={12} /> : 'Добавить'}
          </button>
        </>
      }
    >
      <form id="add-fin-form" onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label className="form-label">Описание *</label>
          <input className="form-input" value={form.description} onChange={set('description')} required />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label className="form-label">Сумма (₽) *</label>
            <input className="form-input" type="number" value={form.amount} onChange={set('amount')} min={0} required />
          </div>
          <div>
            <label className="form-label">Статус</label>
            <select className="form-input" value={form.status} onChange={set('status')}>
              <option value="pending">Ожидание</option>
              <option value="paid">Оплачено</option>
              <option value="cancelled">Отменено</option>
            </select>
          </div>
          <div>
            <label className="form-label">Категория</label>
            <select className="form-input" value={form.category} onChange={set('category')}>
              <option value="dev">Dev</option>
              <option value="design">Design</option>
              <option value="ops">Ops</option>
              <option value="marketing">Marketing</option>
              <option value="salary">Зарплата</option>
            </select>
          </div>
          <div>
            <label className="form-label">Проект</label>
            <select className="form-input" value={form.project_id ?? ''} onChange={set('project_id')}>
              <option value="">Без проекта</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default function FinancePage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [showAdd, setShowAdd]           = useState(false);

  const { data: summary }               = useFinanceSummary();
  const finParams: { status?: string } = {};
  if (statusFilter) finParams.status = statusFilter;
  const { data: records = [], isLoading } = useFinance(finParams);
  const deleteRecord                    = useDeleteFinanceRecord();

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Финансы</h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Учёт доходов и расходов</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Добавить
        </button>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KpiCard label="Оборот" value={`${((summary?.total ?? 0) / 1000).toFixed(0)}к ₽`} />
        <KpiCard label="Оплачено" value={`${((summary?.paid ?? 0) / 1000).toFixed(0)}к ₽`} color="var(--green)"
          progress={summary?.total ? Math.round((summary.paid / summary.total) * 100) : 0} />
        <KpiCard label="Ожидает" value={`${((summary?.pending ?? 0) / 1000).toFixed(0)}к ₽`} color="var(--yellow)" />
        <KpiCard label="Записей" value={summary?.count ?? 0} color="var(--accent)" />
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 20 }}>
        <select className="form-input" style={{ width: 200 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Все статусы</option>
          <option value="paid">Оплачено</option>
          <option value="pending">Ожидание</option>
          <option value="cancelled">Отменено</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size={24} /></div>
      ) : records.length === 0 ? (
        <EmptyState title="Нет записей" message="Добавьте первую финансовую запись" />
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map((rec) => (
                <tr key={rec.id}>
                  <td>{rec.description}</td>
                  <td><TaskTagBadge tag={rec.category} /></td>
                  <td style={{ fontWeight: 600 }}>{rec.amount.toLocaleString('ru')} ₽</td>
                  <td><StatusBadge status={rec.status as FinanceStatus} /></td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(rec.date).toLocaleDateString('ru')}</td>
                  <td>
                    <button className="btn-icon" style={{ opacity: 0.4 }} onClick={() => deleteRecord.mutate(rec.id)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddRecordModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
