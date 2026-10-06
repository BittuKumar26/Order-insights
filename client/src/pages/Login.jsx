import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const result = await api.post(mode === 'login' ? '/auth/login' : '/auth/register', form);
      auth.signIn(result.data);
      const from = location.state?.from?.pathname;
      navigate(from || '/', { replace: true });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand">◆ Order<span>Insights</span></div>
        <h1>{mode === 'login' ? 'Welcome back' : 'Create your user account'}</h1>
        <p className="muted">{mode === 'login' ? 'Sign in to access your workspace.' : 'User accounts can access customer insights only.'}</p>
        {mode === 'register' && <input required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
        <input required type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input required minLength="8" type="password" placeholder="Password (8+ characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {error && <div className="auth-error">{error}</div>}
        <button className="btn primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <button type="button" className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
          {mode === 'login' ? 'New user? Create an account' : 'Already have an account? Sign in'}
        </button>
      </form>
    </main>
  );
}
