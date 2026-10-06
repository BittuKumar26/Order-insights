import { createContext, useContext, useMemo, useState } from 'react';

const STORAGE_KEY = 'order-insights-session';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; } catch { return null; }
  });
  const value = useMemo(() => ({
    session,
    user: session?.user || null,
    signIn(next) { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setSession(next); },
    signOut() { localStorage.removeItem(STORAGE_KEY); setSession(null); },
  }), [session]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function token() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY))?.token || ''; } catch { return ''; }
}
