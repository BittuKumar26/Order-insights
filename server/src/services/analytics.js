// Pure aggregation functions over flat order-line facts (easy to unit test, DB-agnostic).
const round = (n) => Math.round(n * 100) / 100;

function groupByOrder(facts) {
  const map = new Map();
  for (const f of facts) {
    let o = map.get(f.orderId);
    if (!o) {
      o = { orderId: f.orderId, customerId: f.customerId, customerName: f.customerName, orderDate: f.orderDate, status: f.deliveryStatus, delayed: f.delayed, delayDays: f.delayDays, overdue: !!f.overdue, carrier: f.carrier, revenue: 0, units: 0, categories: new Set(), lines: 0 };
      map.set(f.orderId, o);
    }
    o.revenue += f.lineTotal;
    o.units += f.qty;
    o.lines += 1;
    o.categories.add(f.category);
  }
  return [...map.values()];
}

const bucketKey = (date, granularity) => {
  if (!date) return null;
  const iso = new Date(date).toISOString();
  return granularity === 'day' ? iso.slice(0, 10) : iso.slice(0, 7);
};

function topCustomers(orders, rate) {
  const m = new Map();
  for (const o of orders) {
    const c = m.get(o.customerName) || { customer: o.customerName, revenue: 0, orders: 0 };
    c.revenue += o.revenue; c.orders += 1; m.set(o.customerName, c);
  }
  return [...m.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5).map((c) => ({ ...c, revenue: round(c.revenue * rate) }));
}

function summarize(facts, { granularity = 'month', rate = 1 } = {}) {
  const orders = groupByOrder(facts);
  const rev = (n) => round(n * rate);

  const totalRevenue = orders.reduce((s, o) => s + o.revenue, 0);
  const delayed = orders.filter((o) => o.delayed);
  const lateDelivered = delayed.filter((o) => !o.overdue);

  const trendMap = new Map();
  for (const o of orders) {
    const k = bucketKey(o.orderDate, granularity);
    if (!k) continue; // orders with no valid date can't be placed on the timeline
    const t = trendMap.get(k) || { period: k, revenue: 0, orders: 0 };
    t.revenue += o.revenue;
    t.orders += 1;
    trendMap.set(k, t);
  }

  const catMap = new Map();
  const catOrders = new Map();
  for (const f of facts) {
    const c = catMap.get(f.category) || { category: f.category, revenue: 0, units: 0 };
    c.revenue += f.lineTotal;
    c.units += f.qty;
    catMap.set(f.category, c);
    if (!catOrders.has(f.category)) catOrders.set(f.category, new Set());
    catOrders.get(f.category).add(f.orderId);
  }

  const statusMap = new Map();
  for (const o of orders) statusMap.set(o.status, (statusMap.get(o.status) || 0) + 1);
  const ORDER = ['Delivered', 'In Transit', 'Delayed', 'Pending'];

  return {
    kpis: {
      totalOrders: orders.length,
      totalRevenue: rev(totalRevenue),
      delayedOrders: delayed.length,
      avgOrderValue: orders.length ? rev(totalRevenue / orders.length) : 0,
      delayRate: orders.length ? round((delayed.length / orders.length) * 100) : 0,
      // average lateness of shipments that actually arrived late (overdue-undelivered would skew it with days-to-today)
      avgDelayDays: lateDelivered.length ? round(lateDelivered.reduce((s, o) => s + o.delayDays, 0) / lateDelivered.length) : 0,
      overdueOrders: delayed.length - lateDelivered.length,
    },
    trend: [...trendMap.values()].sort((a, b) => a.period.localeCompare(b.period)).map((t) => ({ ...t, revenue: rev(t.revenue) })),
    byCategory: [...catMap.values()]
      .map((c) => ({ ...c, revenue: rev(c.revenue), orders: catOrders.get(c.category).size }))
      .sort((a, b) => b.revenue - a.revenue),
    topCustomers: topCustomers(orders, rate),
    delivery: ORDER.filter((s) => statusMap.has(s)).map((s) => ({ status: s, orders: statusMap.get(s) })),
  };
}

function categoryDrilldown(facts, category, rate = 1) {
  const rows = facts.filter((f) => f.category === category);
  const map = new Map();
  for (const f of rows) {
    const p = map.get(f.productId) || { productId: f.productId, name: f.productName, revenue: 0, units: 0, orders: new Set() };
    p.revenue += f.lineTotal;
    p.units += f.qty;
    p.orders.add(f.orderId);
    map.set(f.productId, p);
  }
  return {
    category,
    products: [...map.values()].map((p) => ({ productId: p.productId, name: p.name, units: p.units, orders: p.orders.size, revenue: round(p.revenue * rate) })).sort((a, b) => b.revenue - a.revenue),
  };
}

function listOrders(facts, { page = 1, limit = 10, sort = 'orderDate', dir = 'desc', q = '', rate = 1 } = {}) {
  let orders = groupByOrder(facts);
  const needle = q.trim().toLowerCase();
  if (needle) orders = orders.filter((o) => o.orderId.toLowerCase().includes(needle) || o.customerName.toLowerCase().includes(needle));
  const key = { orderDate: 'orderDate', revenue: 'revenue', orderId: 'orderId' }[sort] || 'orderDate';
  const sign = dir === 'asc' ? 1 : -1;
  orders.sort((a, b) => {
    const x = a[key] instanceof Date ? a[key].getTime() : a[key] ?? 0;
    const y = b[key] instanceof Date ? b[key].getTime() : b[key] ?? 0;
    return (x < y ? -1 : x > y ? 1 : 0) * sign;
  });
  const total = orders.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const p = Math.min(Math.max(1, page), pages);
  const rows = orders.slice((p - 1) * limit, p * limit).map((o) => ({
    orderId: o.orderId,
    customer: o.customerName,
    orderDate: o.orderDate ? new Date(o.orderDate).toISOString().slice(0, 10) : null,
    units: o.units,
    categories: [...o.categories],
    totalValue: round(o.revenue * rate),
    status: o.status,
    delayDays: o.delayDays,
    carrier: o.carrier,
  }));
  return { rows, pagination: { page: p, limit, total, pages } };
}

module.exports = { summarize, categoryDrilldown, listOrders, groupByOrder };
