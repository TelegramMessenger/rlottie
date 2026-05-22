/**
 * @file src/client/pages/LoginPage.tsx
 * Страница входа/регистрации в BAZZAR.
 *
 * При успешном входе:
 *  - сохраняет JWT и данные пользователя в localStorage
 *  - возвращает на исходный путь (если был редирект от ProtectedRoute)
 *  - иначе → /home
 */

import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle, UserPlus, User } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import { BrandLogo } from '../components/ui/BrandLogo';
import { login, register, isAuthenticated } from '../auth/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/home';

  if (isAuthenticated()) {
    return <Navigate to={from} replace />;
  }

  const [mode,     setMode]     = useState<'login' | 'register'>('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сервера');
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at top right, rgba(170,255,71,.08), transparent 50%), var(--bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ marginBottom: 16 }}>
            <BrandLogo size={64} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em' }}>BAZZAR</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Платформа управления бизнесом
          </div>
        </div>

        {/* Form card */}
        <div className="card" style={{ padding: 28 }}>

          {/* Mode tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--bg-secondary)', borderRadius: 10, padding: 4 }}>
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(''); }}
                style={{
                  flex: 1, height: 34, borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                  background: mode === m ? 'var(--bg-card)' : 'transparent',
                  color: mode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,.25)' : 'none',
                  transition: 'all .15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {m === 'login' ? <LogIn size={13} /> : <UserPlus size={13} />}
                {m === 'login' ? 'Войти' : 'Регистрация'}
              </button>
            ))}
          </div>

          <form onSubmit={(e) => { void handleSubmit(e); }}>

            {/* Name (register only) */}
            {mode === 'register' && (
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Имя</label>
                <div className="field-with-icon">
                  <User size={15} className="field-icon" />
                  <input
                    className="form-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Иван Иванов"
                    autoComplete="name"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Email</label>
              <div className="field-with-icon">
                <Mail size={15} className="field-icon" />
                <input
                  className="form-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@bazzar.ru"
                  autoComplete="email"
                  autoFocus={mode === 'login'}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ margin: 0 }}>Пароль</label>
                {mode === 'login' && (
                  <a
                    href="#"
                    style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}
                    onClick={(e) => { e.preventDefault(); alert('Восстановление пароля — TODO'); }}
                  >
                    Забыли?
                  </a>
                )}
              </div>
              <div className="field-with-icon">
                <Lock size={15} className="field-icon" />
                <input
                  className="form-input has-action"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Минимум 6 символов' : '••••••••'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  className="field-action"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'rgba(239,68,68,.1)',
                  border: '1px solid rgba(239,68,68,.25)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 12,
                  color: '#ef4444',
                  marginBottom: 16,
                }}
              >
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              className="btn btn-primary"
              type="submit"
              style={{ width: '100%', height: 40, fontSize: 13 }}
              disabled={loading}
            >
              {loading ? (
                <Spinner size={14} />
              ) : mode === 'login' ? (
                <><LogIn size={14} />Войти в аккаунт</>
              ) : (
                <><UserPlus size={14} />Создать аккаунт</>
              )}
            </button>
          </form>

          {/* Hint */}
          <div style={{
            marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)',
            textAlign: 'center', fontSize: 11, color: 'var(--text-muted)',
          }}>
            {mode === 'login'
              ? <>Нет аккаунта? <button type="button" onClick={() => setMode('register')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, fontSize: 11, padding: 0 }}>Зарегистрироваться</button></>
              : <>Уже есть аккаунт? <button type="button" onClick={() => setMode('login')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, fontSize: 11, padding: 0 }}>Войти</button></>
            }
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'var(--text-muted)' }}>
          © {new Date().getFullYear()} BAZZAR · Все права защищены
        </div>
      </div>
    </div>
  );
}
