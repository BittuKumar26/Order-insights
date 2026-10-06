const categories = ['Electronics', 'Home', 'Fashion', 'Beauty'];
const statuses = ['Delivered', 'In Transit', 'Delayed', 'Pending'];
const customers = ['Aarav Sharma', 'Mia Wilson', 'Noah Brown', 'Sofia Garcia', 'Liam Smith', 'Ananya Patel'];
const products = [
  { productId: 'P-1001', name: 'Wireless Headphones', category: 'Electronics', price: 2499 },
  { productId: 'P-1002', name: 'Smart Watch', category: 'Electronics', price: 4999 },
  { productId: 'P-1003', name: 'Cotton Bedsheet', category: 'Home', price: 1299 },
  { productId: 'P-1004', name: 'Ceramic Planter', category: 'Home', price: 799 },
  { productId: 'P-1005', name: 'Everyday Sneakers', category: 'Fashion', price: 2999 },
  { productId: 'P-1006', name: 'Hydrating Face Cream', category: 'Beauty', price: 899 },
];

const orders = Array.from({ length: 36 }, (_, index) => {
  const product = products[index % products.length];
  const date = new Date(Date.UTC(2025, index % 12, (index * 3) % 26 + 1));
  const status = statuses[index % statuses.length];
  const units = (index % 4) + 1;
  return {
    orderId: `ORD-${String(1001 + index)}`,
    customer: customers[index % customers.length],
    orderDate: date.toISOString().slice(0, 10),
    categories: [product.category],
    units,
    totalValue: units * product.price,
    status,
    delayDays: status === 'Delayed' ? (index % 5) + 1 : 0,
    productId: product.productId,
    productName: product.name,
  };
});

const json = (data, meta) => ({ success: true, data, ...(meta ? { meta } : {}) });
const paramsOf = (path) => new URLSearchParams(path.split('?')[1] || '');
const filterOrders = (params) => orders.filter((order) => (
  (!params.get('category') || order.categories.includes(params.get('category')))
  && (!params.get('status') || order.status === params.get('status'))
  && (!params.get('from') || order.orderDate >= params.get('from'))
  && (!params.get('to') || order.orderDate <= params.get('to'))
  && (!params.get('q') || `${order.orderId} ${order.customer}`.toLowerCase().includes(params.get('q').toLowerCase()))
));

function summary(params) {
  const rows = filterOrders(params);
  const totalRevenue = rows.reduce((sum, row) => sum + row.totalValue, 0);
  const delayedOrders = rows.filter((row) => row.status === 'Delayed').length;
  const periods = [...new Set(rows.map((row) => row.orderDate.slice(0, 7)))].sort();
  return {
    kpis: {
      totalOrders: rows.length,
      totalRevenue,
      avgOrderValue: rows.length ? totalRevenue / rows.length : 0,
      delayedOrders,
      delayRate: rows.length ? Number((delayedOrders * 100 / rows.length).toFixed(1)) : 0,
      avgDelayDays: delayedOrders ? Number((rows.reduce((sum, row) => sum + row.delayDays, 0) / delayedOrders).toFixed(1)) : 0,
    },
    trend: periods.map((period) => {
      const periodRows = rows.filter((row) => row.orderDate.startsWith(period));
      return { period, orders: periodRows.length, revenue: periodRows.reduce((sum, row) => sum + row.totalValue, 0) };
    }),
    delivery: statuses.map((status) => ({ status, orders: rows.filter((row) => row.status === status).length })).filter((row) => row.orders),
    byCategory: categories.map((category) => {
      const categoryRows = rows.filter((row) => row.categories.includes(category));
      return { category, orders: categoryRows.length, revenue: categoryRows.reduce((sum, row) => sum + row.totalValue, 0) };
    }).filter((row) => row.orders),
    topCustomers: customers.map((customer) => {
      const customerRows = rows.filter((row) => row.customer === customer);
      return { customer, orders: customerRows.length, revenue: customerRows.reduce((sum, row) => sum + row.totalValue, 0) };
    }).filter((row) => row.orders).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
  };
}

export function mockRequest(path, { method = 'GET', body } = {}) {
  const route = path.split('?')[0];
  const params = paramsOf(path);
  if (path.startsWith('/auth/')) {
    const form = body || {};
    return Promise.resolve(json({ token: 'demo-token', user: { name: form.name || 'Demo User', email: form.email || 'demo@example.com', role: 'admin' } }));
  }
  if (route === '/meta/filters') {
    return Promise.resolve(json({ categories, statuses, currencies: ['INR', 'USD', 'EUR', 'GBP', 'AED', 'JPY'], dateRange: { min: '2025-01-01', max: '2025-12-31' } }));
  }
  if (path.startsWith('/analytics/summary')) return Promise.resolve(json(summary(params), { currency: params.get('currency') || 'INR', granularity: params.get('granularity') || 'month' }));
  if (path.startsWith('/analytics/category/')) {
    const category = decodeURIComponent(path.split('/analytics/category/')[1].split('?')[0]);
    const rows = filterOrders(params).filter((row) => row.categories.includes(category));
    return Promise.resolve(json({ products: products.filter((product) => product.category === category).map((product) => ({
      productId: product.productId, name: product.name, units: rows.filter((row) => row.productId === product.productId).reduce((sum, row) => sum + row.units, 0),
      orders: rows.filter((row) => row.productId === product.productId).length, revenue: rows.filter((row) => row.productId === product.productId).reduce((sum, row) => sum + row.totalValue, 0),
    })) }));
  }
  if (route === '/orders') {
    const filtered = filterOrders(params).sort((a, b) => params.get('dir') === 'asc'
      ? String(a[params.get('sort') || 'orderDate']).localeCompare(String(b[params.get('sort') || 'orderDate']))
      : String(b[params.get('sort') || 'orderDate']).localeCompare(String(a[params.get('sort') || 'orderDate'])));
    const limit = Number(params.get('limit')) || 10;
    const page = Number(params.get('page')) || 1;
    const pages = Math.max(1, Math.ceil(filtered.length / limit));
    return Promise.resolve(json(filtered.slice((page - 1) * limit, page * limit), { pagination: { page, pages, total: filtered.length, limit } }));
  }
  if (route === '/products') {
    return Promise.resolve(json(products.map((product) => {
      const rows = orders.filter((order) => order.productId === product.productId);
      return { ...product, units: rows.reduce((sum, row) => sum + row.units, 0), revenue: rows.reduce((sum, row) => sum + row.totalValue, 0) };
    })));
  }
  if (path.startsWith('/meta/countries')) {
    const countryRows = [
      ['India', 'Asia', 'INR', 1428627663], ['United States', 'Americas', 'USD', 339996563],
      ['Germany', 'Europe', 'EUR', 83294633], ['Japan', 'Asia', 'JPY', 123294513],
      ['Australia', 'Oceania', 'AUD', 26439111], ['Brazil', 'Americas', 'BRL', 216422446],
    ].map(([name, region, code, population]) => ({ name, region, currencies: [{ code }], population, density: Math.round(population / 1000000), code }));
    const filtered = countryRows.filter((country) => (!params.get('q') || country.name.toLowerCase().includes(params.get('q').toLowerCase())) && (!params.get('region') || country.region === params.get('region')));
    const limit = Number(params.get('limit')) || 15;
    const page = Number(params.get('page')) || 1;
    return Promise.resolve(json(filtered.slice((page - 1) * limit, page * limit), { pagination: { page, pages: Math.max(1, Math.ceil(filtered.length / limit)), total: filtered.length, limit } }));
  }
  if (path.startsWith('/ingest/')) return Promise.resolve(json({ file: 'demo-data', received: 36, inserted: 36, updated: 0, skippedOrWarned: 0 }));
  return Promise.resolve(json([]));
}
