const { asyncHandler, HttpError } = require('../utils/errors');
const { ingest, loadSamples } = require('../services/ingest');
const { summarize, categoryDrilldown, listOrders } = require('../services/analytics');
const { parseFilters, fetchFacts, STATUSES } = require('../services/query');
const { getRate, getRates, SUPPORTED } = require('../services/currency');
const { loadCountries, filterCountries } = require('../services/countries');
const { analyticsCache } = require('../services/cache');
const { Fact, Product } = require('../models');
const customers = require('../services/customers');
const auth = require('../services/auth');

const ok = (res, data, meta) => res.json({ success: true, data, ...(meta ? { meta } : {}) });

// Accept an uploaded file (multipart "file"), a raw text body, or (JSON only) a parsed object body.
const payloadOf = (req) => {
  if (req.file) return req.file.buffer.toString('utf8');
  if (typeof req.body === 'string' && req.body.trim()) return req.body;
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length) return req.body;
  throw new HttpError(400, 'Empty request: send a "file" upload or a raw body');
};

const jobs = require('../services/jobs');
const wantsAsync = (req) => req.query.async === 'true';
// With ?async=true the work is queued and the client polls GET /ingest/jobs/:id
const runOrQueue = (req, res, label, work) => {
  if (!wantsAsync(req)) return work().then((r) => ok(res, r));
  const job = jobs.submit(label, work, req.user.id);
  return res.status(202).json({ success: true, data: { jobId: job.id, status: job.status } });
};

const ingestAs = (dataset) => asyncHandler(async (req, res) => {
  const payload = payloadOf(req); // validate input synchronously so bad requests fail fast with 400
  const target = req.query.dataset || dataset;
  if (!['orders', 'products', 'shipments'].includes(target)) throw new HttpError(400, 'dataset must be orders, products or shipments');
  await runOrQueue(req, res, `ingest ${target}`, () => ingest(target, payload, req.user.id));
});

const jobStatus = asyncHandler(async (req, res) => {
  const job = jobs.get(req.params.id, req.user.id);
  if (!job) throw new HttpError(404, 'Job not found');
  ok(res, job);
});

// cache wrapper keyed by route + query
const cached = (name, compute) => asyncHandler(async (req, res) => {
  const key = `${name}:${req.user.id}:${req.originalUrl}`;
  let value = analyticsCache.get(key);
  const hit = value !== undefined;
  if (!hit) { value = await compute(req); analyticsCache.set(key, value); }
  res.set('X-Cache', hit ? 'HIT' : 'MISS');
  ok(res, value.data, value.meta);
});

const summary = cached('summary', async (req) => {
  const { filter, applied } = parseFilters(req.query);
  const cur = await getRate(req.query.currency);
  const granularity = req.query.granularity === 'day' ? 'day' : 'month';
  const data = summarize(await fetchFacts(req.user.id, filter), { granularity, rate: cur.rate });
  return { data, meta: { filters: applied, currency: cur.code, rateSource: cur.source, granularity } };
});

const categoryDetail = cached('category', async (req) => {
  const { filter, applied } = parseFilters({ ...req.query, category: undefined });
  const cur = await getRate(req.query.currency);
  const data = categoryDrilldown(await fetchFacts(req.user.id, { ...filter, category: req.params.category }), req.params.category, cur.rate);
  return { data, meta: { filters: applied, currency: cur.code } };
});

const orders = asyncHandler(async (req, res) => {
  const { filter, applied } = parseFilters(req.query);
  const cur = await getRate(req.query.currency);
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
  const result = listOrders(await fetchFacts(req.user.id, filter), { page, limit, sort: req.query.sort, dir: req.query.dir, q: String(req.query.q || ''), rate: cur.rate });
  ok(res, result.rows, { pagination: result.pagination, filters: applied, currency: cur.code });
});

const products = asyncHandler(async (req, res) => {
  const [list, facts] = await Promise.all([Product.find({ ownerId: req.user.id }).sort({ productId: 1 }).lean(), Fact.find({ ownerId: req.user.id }, 'productId qty lineTotal').lean()]);
  const byId = new Map();
  for (const f of facts) {
    const t = byId.get(f.productId) || { units: 0, revenue: 0 };
    t.units += f.qty; t.revenue += f.lineTotal; byId.set(f.productId, t);
  }
  ok(res, list.map((p) => ({ productId: p.productId, name: p.name, category: p.category, units: byId.get(p.productId)?.units || 0, revenue: Math.round((byId.get(p.productId)?.revenue || 0) * 100) / 100 })));
});

const filterOptions = asyncHandler(async (req, res) => {
  const [categories, first, last] = await Promise.all([
    Fact.distinct('category', { ownerId: req.user.id }),
    Fact.findOne({ ownerId: req.user.id, orderDate: { $ne: null } }, 'orderDate').sort({ orderDate: 1 }).lean(),
    Fact.findOne({ ownerId: req.user.id, orderDate: { $ne: null } }, 'orderDate').sort({ orderDate: -1 }).lean(),
  ]);
  const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
  ok(res, { categories: categories.sort(), statuses: STATUSES, currencies: SUPPORTED, dateRange: { min: iso(first?.orderDate), max: iso(last?.orderDate) } });
});

const rates = asyncHandler(async (req, res) => ok(res, await getRates()));

const countries = asyncHandler(async (req, res) => {
  const n = (v) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? undefined : Number(v));
  const list = filterCountries(await loadCountries(), { region: req.query.region, minPop: n(req.query.minPop), maxPop: n(req.query.maxPop), currency: req.query.currency, q: req.query.q });
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 15, 100);
  ok(res, list.slice((page - 1) * limit, page * limit), { pagination: { page, limit, total: list.length, pages: Math.max(1, Math.ceil(list.length / limit)) } });
});

// ---- User / customer dashboard ----
const userOverview = cached('users-overview', async (req) => {
  const cur = await getRate(req.query.currency);
  const g = req.query.granularity || 'month';
  if (!customers.GRANULARITIES.includes(g)) throw new HttpError(400, `granularity must be one of: ${customers.GRANULARITIES.join(', ')}`);
  return { data: customers.overview(await fetchFacts(req.user.id, {}), { granularity: g, rate: cur.rate }), meta: { currency: cur.code } };
});
const userList = asyncHandler(async (req, res) => {
  const cur = await getRate(req.query.currency);
  const r = customers.listCustomers(await fetchFacts(req.user.id, {}), { page: parseInt(req.query.page, 10) || 1, limit: Math.min(parseInt(req.query.limit, 10) || 10, 100), q: String(req.query.q || ''), sort: req.query.sort, dir: req.query.dir, rate: cur.rate });
  ok(res, r.rows, { pagination: r.pagination, currency: cur.code });
});
const userDetail = asyncHandler(async (req, res) => {
  const cur = await getRate(req.query.currency);
  const d = customers.customerDetail(await fetchFacts(req.user.id, {}), req.params.id, cur.rate);
  if (!d) throw new HttpError(404, `Customer ${req.params.id} not found`);
  ok(res, d, { currency: cur.code });
});

const health = (req, res) => ok(res, { status: 'up', time: new Date().toISOString() });
const register = asyncHandler(async (req, res) => ok(res, await auth.register(req.body)));
const login = asyncHandler(async (req, res) => ok(res, await auth.login(req.body)));
const me = asyncHandler(async (req, res) => ok(res, { user: req.user }));
const samples = asyncHandler(async (req, res) => { await runOrQueue(req, res, 'load samples', () => loadSamples(req.user.id)); });
const reset = asyncHandler(async (req, res) => {
  const { Order, Shipment } = require('../models');
  const ownerFilter = { ownerId: req.user.id };
  await Promise.all([Fact.deleteMany(ownerFilter), Order.deleteMany(ownerFilter), Shipment.deleteMany(ownerFilter), Product.deleteMany(ownerFilter)]);
  analyticsCache.flushAll();
  ok(res, { cleared: true });
});

module.exports = { userOverview, userList, userDetail, jobStatus, ingestAs, samples, reset, summary, categoryDetail, orders, products, filterOptions, rates, countries, health, register, login, me };
