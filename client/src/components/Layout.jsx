import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { LayoutDashboard, ShoppingCart, Package, Globe2, UploadCloud, Search, Menu, Bell } from 'lucide-react';
import { setFilter } from '../store/filtersSlice';
import { useAuth } from '../auth';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/countries', label: 'Countries', icon: Globe2 },
  { to: '/ingest', label: 'Data Ingest', icon: UploadCloud },
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const dispatch = useDispatch();
  const { user, signOut } = useAuth();
  const { currency } = useSelector((s) => s.filters);
  const options = useSelector((s) => s.dashboard.options?.currencies) || ['INR', 'USD', 'EUR', 'GBP', 'AED', 'JPY'];

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">◆ Order<span>Insights</span></div>
        <div className="profile"><div className="avatar">AD</div><b>{user.name}</b><button className="auth-switch" onClick={signOut}>Sign out</button></div>
        <nav>
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon size={20} /> {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
          <form className="search" onSubmit={(e) => { e.preventDefault(); nav(`/orders?q=${encodeURIComponent(q)}`); }}>
            <Search size={18} />
            <input placeholder="Search order ID or customer…" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <div className="top-right">
            <label className="cur">Currency
              <select value={currency} onChange={(e) => dispatch(setFilter({ currency: e.target.value }))}>
                {options.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <Bell size={20} className="muted" />
            <div className="avatar sm">AD</div>
          </div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}
