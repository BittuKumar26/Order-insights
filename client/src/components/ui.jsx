import { Loader2, AlertTriangle, Inbox } from 'lucide-react';

export const Card = ({ title, subtitle, action, children, className = '' }) => (
  <section className={`card ${className}`}>
    {(title || action) && (
      <div className="card-head">
        <div><h3>{title}</h3>{subtitle && <p className="muted">{subtitle}</p>}</div>
        {action}
      </div>
    )}
    {children}
  </section>
);

export const Loading = ({ label = 'Loading…' }) => (
  <div className="state"><Loader2 className="spin" size={22} /><span>{label}</span></div>
);

export const ErrorState = ({ message, onRetry }) => (
  <div className="state error" role="alert">
    <AlertTriangle size={22} />
    <span>{message}</span>
    {onRetry && <button className="btn" onClick={onRetry}>Retry</button>}
  </div>
);

export const Empty = ({ children = 'No data for the selected filters.' }) => (
  <div className="state"><Inbox size={22} /><span>{children}</span></div>
);

export const Toggle = ({ value, options, onChange }) => (
  <div className="toggle" role="group">
    {options.map((o) => (
      <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
    ))}
  </div>
);

export const KpiCard = ({ tone, icon: Icon, value, label, hint }) => (
  <div className={`kpi ${tone}`}>
    <div className="kpi-icon"><Icon size={24} /></div>
    <div className="kpi-value">{value}</div>
    <div className="kpi-label">{label}</div>
    {hint && <div className="kpi-hint">{hint}</div>}
  </div>
);

export const Pager = ({ page, pages, total, onChange }) => (
  <div className="pager">
    <span className="muted">{total} {total === 1 ? "result" : "results"}</span>
    <div>
      <button className="btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>Prev</button>
      <span className="muted"> Page {page} of {pages} </span>
      <button className="btn" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
    </div>
  </div>
);
