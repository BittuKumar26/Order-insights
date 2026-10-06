const LOCALE = { INR: 'en-IN', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB', AED: 'en-AE', JPY: 'ja-JP' };
export const money = (n, cur = 'INR') =>
  new Intl.NumberFormat(LOCALE[cur] || 'en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n || 0);
export const compact = (n, cur = 'INR') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
export const num = (n) => new Intl.NumberFormat('en-IN').format(n || 0);
export const periodLabel = (p) => {
  if (!p) return '';
  const d = new Date(p.length === 7 ? `${p}-01T00:00:00Z` : `${p}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', p.length === 7 ? { month: 'short', year: '2-digit', timeZone: 'UTC' } : { day: '2-digit', month: 'short', timeZone: 'UTC' });
};
export const STATUS_COLORS = { Delivered: '#22c55e', 'In Transit': '#1890ff', Delayed: '#ff4842', Pending: '#ffc107' };
