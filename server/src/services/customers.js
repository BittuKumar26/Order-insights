// Customer ("user") analytics: pure functions over order-line facts.
const { groupByOrder } = require('./analytics');
const round = (n) => Math.round(n * 100) / 100;

const GRANULARITIES = ['week', 'month', 'year'];

function periodKey(date, g) {
  const d = new Date(date);
  if (g === 'year') return String(d.getUTCFullYear());
  if (g === 'month') return d.toISOString().slice(0, 7);
  const back = (d.getUTCDay() + 6) % 7; // week starts Monday
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back)).toISOString().slice(0, 10);
}

const segmentOf = (orders) => (orders >= 4 ? 'Loyal' : orders >= 2 ? 'Regular' : 'New');

// One profile per customer, with all of their (order-level) records.
function buildProfiles(facts) {
  const map = new Map();
  for (const o of groupByOrder(facts)) {
    const id = o.customerId || o.customerName;
    const p = map.get(id) || { customerId: id, name: o.customerName, orders: [], revenue: 0, units: 0, delayedOrders: 0 };
    p.orders.push(o);
    p.revenue += o.revenue;
    p.units += o.units;
    if (o.delayed) p.delayedOrders += 1;
    map.set(id, p);
  }
  for (const p of map.values()) {
    const dates = p.orders.map((o) => o.orderDate).filter(Boolean).map((d) => new Date(d).getTime());
    p.firstOrder = dates.length ? new Date(Math.min(...dates)) : null;
    p.lastOrder = dates.length ? new Date(Math.max(...dates)) : null;
  }
  return [...map.values()];
}

const pct = (cur, prev) => (prev ? round(((cur - prev) / prev) * 100) : null);
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

function overview(facts, { granularity = 'month', rate = 1 } = {}) {
  const g = GRANULARITIES.includes(granularity) ? granularity : 'month';
  const profiles = buildProfiles(facts);
  const seriesMap = new Map();
  const slot = (k) => {
    if (!seriesMap.has(k)) seriesMap.set(k, { period: k, newCustomers: 0, returningCustomers: 0, orders: 0, revenue: 0 });
    return seriesMap.get(k);
  };

  for (const p of profiles) {
    if (!p.firstOrder) continue;
    const first = periodKey(p.firstOrder, g);
    const seen = new Map(); // period -> {orders, revenue}
    for (const o of p.orders) {
      if (!o.orderDate) continue;
      const k = periodKey(o.orderDate, g);
      const s = seen.get(k) || { orders: 0, revenue: 0 };
      s.orders += 1; s.revenue += o.revenue; seen.set(k, s);
    }
    for (const [k, s] of seen) {
      const row = slot(k);
      if (k === first) row.newCustomers += 1; else row.returningCustomers += 1;
      row.orders += s.orders;
      row.revenue += s.revenue;
    }
  }

  const series = [...seriesMap.values()].sort((a, b) => a.period.localeCompare(b.period)).map((r) => ({ ...r, revenue: round(r.revenue * rate) }));
  const last = series[series.length - 1] || { newCustomers: 0, returningCustomers: 0, orders: 0, revenue: 0 };
  const prev = series[series.length - 2];
  const active = (r) => (r ? r.newCustomers + r.returningCustomers : 0);
  const tail = series.slice(-8);

  const totalRevenue = profiles.reduce((s, p) => s + p.revenue, 0);
  const totalOrders = profiles.reduce((s, p) => s + p.orders.length, 0);
  const repeat = profiles.filter((p) => p.orders.length >= 2).length;
  const seg = { New: 0, Regular: 0, Loyal: 0 };
  profiles.forEach((p) => { seg[segmentOf(p.orders.length)] += 1; });

  return {
    granularity: g,
    kpis: {
      totalCustomers: profiles.length,
      activeCustomers: active(last),
      newCustomers: last.newCustomers,
      repeatRate: profiles.length ? round((repeat / profiles.length) * 100) : 0,
      avgOrdersPerCustomer: profiles.length ? round(totalOrders / profiles.length) : 0,
      avgCustomerValue: profiles.length ? round((totalRevenue / profiles.length) * rate) : 0,
      totalRevenue: round(totalRevenue * rate),
      latestPeriod: last.period || null,
    },
    changes: { active: pct(active(last), active(prev)), newCustomers: pct(last.newCustomers, prev?.newCustomers), orders: pct(last.orders, prev?.orders), revenue: pct(last.revenue, prev?.revenue) },
    spark: { active: tail.map(active), newCustomers: tail.map((r) => r.newCustomers), orders: tail.map((r) => r.orders), revenue: tail.map((r) => r.revenue) },
    segments: Object.entries(seg).map(([segment, customers]) => ({ segment, customers })),
    series,
  };
}

function listCustomers(facts, { page = 1, limit = 10, q = '', sort = 'revenue', dir = 'desc', rate = 1 } = {}) {
  let rows = buildProfiles(facts).map((p) => ({
    customerId: p.customerId, name: p.name, orders: p.orders.length, units: p.units, revenue: round(p.revenue * rate),
    firstOrder: iso(p.firstOrder), lastOrder: iso(p.lastOrder), delayedOrders: p.delayedOrders, segment: segmentOf(p.orders.length),
  }));
  const needle = q.trim().toLowerCase();
  if (needle) rows = rows.filter((r) => r.name.toLowerCase().includes(needle) || String(r.customerId).toLowerCase().includes(needle));
  const key = ['revenue', 'orders', 'name', 'lastOrder'].includes(sort) ? sort : 'revenue';
  const sign = dir === 'asc' ? 1 : -1;
  rows.sort((a, b) => ((a[key] ?? '') < (b[key] ?? '') ? -1 : (a[key] ?? '') > (b[key] ?? '') ? 1 : 0) * sign);
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const p = Math.min(Math.max(1, page), pages);
  return { rows: rows.slice((p - 1) * limit, p * limit), pagination: { page: p, limit, total, pages } };
}

function customerDetail(facts, id, rate = 1) {
  const p = buildProfiles(facts).find((x) => String(x.customerId) === String(id));
  if (!p) return null;
  const cats = new Map();
  for (const f of facts) {
    if ((f.customerId || f.customerName) !== p.customerId) continue;
    cats.set(f.category, (cats.get(f.category) || 0) + f.lineTotal);
  }
  const orders = [...p.orders].sort((a, b) => new Date(b.orderDate || 0) - new Date(a.orderDate || 0));
  return {
    customerId: p.customerId, name: p.name, segment: segmentOf(orders.length),
    totals: { orders: orders.length, units: p.units, revenue: round(p.revenue * rate), avgOrderValue: orders.length ? round((p.revenue / orders.length) * rate) : 0, delayedOrders: p.delayedOrders, firstOrder: iso(p.firstOrder), lastOrder: iso(p.lastOrder) },
    byCategory: [...cats].map(([category, v]) => ({ category, revenue: round(v * rate) })).sort((a, b) => b.revenue - a.revenue),
    orders: orders.map((o) => ({ orderId: o.orderId, orderDate: iso(o.orderDate), totalValue: round(o.revenue * rate), status: o.status, delayDays: o.delayDays, categories: [...o.categories] })),
  };
}

module.exports = { overview, listCustomers, customerDetail, periodKey, segmentOf, GRANULARITIES };
