import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { StatusPill, type PillStatus, type PillVariant } from '../components/ui/Badge';
import { getAuthUser, logout } from '../auth/auth';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [lang,  setLang]  = useState('ru');

  const user = getAuthUser();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const applyTheme = (t: 'dark' | 'light') => {
    setTheme(t);
    document.documentElement.setAttribute('data-theme', t);
  };

  return (
    <div style={{ padding: 32, maxWidth: 600 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Настройки</h1>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Персонализация и конфигурация</div>
      </div>

      {/* Appearance */}
      <section className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Внешний вид</div>
        <div style={{ marginBottom: 16 }}>
          <label className="form-label">Тема</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['dark', 'light'] as const).map((t) => (
              <button
                key={t}
                className={`btn ${theme === t ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                onClick={() => applyTheme(t)}
              >
                {{ dark: 'Тёмная', light: 'Светлая' }[t]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="form-label">Язык интерфейса</label>
          <select className="form-input" style={{ width: 200 }} value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </div>
      </section>

      {/* Account */}
      <section className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Аккаунт</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label className="form-label">Имя</label>
            <input className="form-input" defaultValue={user?.name ?? ''} />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input className="form-input" type="email" defaultValue={user?.email ?? ''} />
          </div>
        </div>
        <button className="btn btn-primary btn-sm">Сохранить изменения</button>
      </section>

      {/* System info */}
      <section className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>О системе</div>
        {[
          { label: 'Версия',    value: '1.0.0' },
          { label: 'Стек',      value: 'React 19 + TypeScript + Fastify + SQLite' },
          { label: 'Сборка',    value: 'Vite 6' },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
            <span>{value}</span>
          </div>
        ))}
      </section>

      {/* Status pills showcase */}
      <section className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Статусные плашки</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
          5 статусов × 3 варианта стиля
        </div>
        {(['verified', 'blocked', 'inactive', 'active', 'unverified'] as PillStatus[]).map((status) => (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            {(['soft', 'outline', 'solid'] as PillVariant[]).map((variant) => (
              <StatusPill key={variant} status={status} variant={variant} />
            ))}
          </div>
        ))}
      </section>

      {/* Logout */}
      <button className="btn btn-danger btn-sm" onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <LogOut size={14} /> Выйти из системы
      </button>
    </div>
  );
}
