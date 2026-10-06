const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { parseJson, parseCsv, parseXml } = require('../src/services/parsers');
const { normalizeOrders, normalizeProducts, normalizeShipments, deliveryInfo, buildFacts } = require('../src/services/transform');
const { summarize, categoryDrilldown, listOrders } = require('../src/services/analytics');
const { parseDate } = require('../src/utils/dates');

const read = (f) => fs.readFileSync(path.join(__dirname, '../data', f), 'utf8');

test('repairs the quote-wrapped Orders.json supplied with the exercise', () => {
  const json = parseJson(read('Orders.json'));
  assert.strictEqual(json.orders.length, 2);
  assert.strictEqual(json.orders[0].items[1].price, 1200);
});

test('repairs the quote-wrapped Products.csv', () => {
  const rows = parseCsv(read('Products.csv'));
  assert.deepStrictEqual(rows[0], { ProductID: 'P101', ProductName: 'Laptop', Category: 'Electronics' });
  assert.strictEqual(rows.length, 3);
});

test('parses clean CSV too', () => {
  assert.strictEqual(parseCsv(read('Products_extended.csv')).length, 7);
});

test('parses XML shipments incl. single-record documents', () => {
  const recs = parseXml('<shipments><shipment id="S1"><order_id>1</order_id></shipment></shipments>');
  assert.strictEqual(recs.length, 1);
  assert.strictEqual(normalizeShipments(recs).docs[0].shipmentId, 'S1');
});

test('date parsing handles ISO, DD/MM/YYYY and rejects junk/overflow', () => {
  assert.strictEqual(parseDate('2024-01-05').toISOString().slice(0, 10), '2024-01-05');
  assert.strictEqual(parseDate('15/04/2024').toISOString().slice(0, 10), '2024-04-15');
  assert.strictEqual(parseDate('2024-02-31'), null);
  assert.strictEqual(parseDate('nope'), null);
});

test('cleans dirty order values and reports issues', () => {
  const { docs, issues } = normalizeOrders({ orders: [{ order_id: 'X', items: [{ product_id: 'P1', qty: '3', price: '₹1,200' }, { product_id: 'P2', qty: 1, price: null }], order_date: 'bad' }] });
  assert.deepStrictEqual(docs[0].items, [{ productId: 'P1', qty: 3, price: 1200 }, { productId: 'P2', qty: 1, price: 0 }]);
  assert.strictEqual(docs[0].customerName, 'Unknown');
  assert.ok(issues.length >= 3);
});

test('delivery flag: on time, late, overdue, in transit, pending', () => {
  const d = (s) => new Date(s + 'T00:00:00Z');
  const now = d('2024-06-01');
  assert.strictEqual(deliveryInfo({ expectedDate: d('2024-01-05'), deliveryDate: d('2024-01-05') }, now).status, 'Delivered');
  assert.deepStrictEqual(deliveryInfo({ expectedDate: d('2024-01-05'), deliveryDate: d('2024-01-08') }, now), { status: 'Delayed', delayed: true, delayDays: 3, overdue: false });
  assert.strictEqual(deliveryInfo({ expectedDate: d('2024-05-01') }, now).status, 'Delayed');
  assert.strictEqual(deliveryInfo({ expectedDate: d('2024-06-10') }, now).status, 'In Transit');
  assert.strictEqual(deliveryInfo(undefined, now).status, 'Pending');
});

function sampleFacts() {
  const orders = normalizeOrders(parseJson(read('Orders.json'))).docs;
  const products = normalizeProducts(parseCsv(read('Products.csv'))).docs;
  const shipments = normalizeShipments([
    { order_id: '1001', expected_date: '2024-01-05', delivery_date: '2024-01-04' },
    { order_id: '1002', expected_date: '2024-01-05', delivery_date: '2024-01-09' },
  ]).docs;
  return buildFacts(orders, products, shipments, new Date('2024-06-01T00:00:00Z'));
}

test('joins orders + products + shipments and totals correctly', () => {
  const facts = sampleFacts();
  assert.strictEqual(facts.length, 3); // 2 items + 1 item flattened
  const s = summarize(facts);
  assert.strictEqual(s.kpis.totalOrders, 2);
  assert.strictEqual(s.kpis.totalRevenue, 2 * 500 + 1200 + 3 * 200); // 2800
  assert.strictEqual(s.kpis.delayedOrders, 1);
  assert.deepStrictEqual(s.byCategory.map((c) => [c.category, c.revenue]), [['Electronics', 2200], ['Furniture', 600]]);
  assert.strictEqual(s.trend[0].period, '2024-01');
});

test('currency rate, drill-down and pagination', () => {
  const facts = sampleFacts();
  assert.strictEqual(summarize(facts, { rate: 0.5 }).kpis.totalRevenue, 1400);
  assert.strictEqual(categoryDrilldown(facts, 'Electronics').products[0].name, 'Phone');
  const page = listOrders(facts, { page: 1, limit: 1, sort: 'revenue', dir: 'desc' });
  assert.strictEqual(page.rows[0].orderId, '1001');
  assert.strictEqual(page.pagination.pages, 2);
});

test('end-to-end on full sample data produces sane numbers', () => {
  const orders = [...normalizeOrders(parseJson(read('Orders.json'))).docs, ...normalizeOrders(parseJson(read('Orders_extended.json'))).docs];
  const products = [...normalizeProducts(parseCsv(read('Products.csv'))).docs, ...normalizeProducts(parseCsv(read('Products_extended.csv'))).docs];
  const shipments = normalizeShipments(parseXml(read('Shipments.xml'))).docs;
  const s = summarize(buildFacts(orders, products, shipments));
  assert.strictEqual(s.kpis.totalOrders, 92);
  assert.ok(s.kpis.delayedOrders > 0 && s.kpis.delayedOrders < 92);
  assert.ok(s.byCategory.some((c) => c.category === 'Uncategorized')); // unknown product P999
  assert.ok(s.trend.length >= 8);
});

test('top customers ranked by revenue; jobs queue completes', async () => {
  const s = summarize(sampleFacts());
  assert.deepStrictEqual(s.topCustomers.map((c) => c.customer), ['Rahul', 'Anita']);
  const jobs = require('../src/services/jobs');
  const j = jobs.submit('t', async () => 42);
  await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(jobs.get(j.id).status, 'done');
  assert.strictEqual(jobs.get(j.id).result, 42);
});

test('avg delay ignores overdue-undelivered orders', () => {
  const mk = (id, over, days) => ({ orderId: id, orderDate: new Date('2024-01-01'), customerName: 'x', category: 'c', productId: 'p', productName: 'p', qty: 1, price: 1, lineTotal: 1, deliveryStatus: 'Delayed', delayed: true, delayDays: days, overdue: over });
  const k = summarize([mk('1', false, 4), mk('2', true, 800)]).kpis;
  assert.strictEqual(k.delayedOrders, 2);
  assert.strictEqual(k.avgDelayDays, 4);
  assert.strictEqual(k.overdueOrders, 1);
});

test('REST Countries payload is flattened (nested currencies/languages) and filterable', () => {
  const { normalizeCountry, filterCountries } = require('../src/services/countries');
  const raw = [
    { name: { common: 'India' }, cca2: 'IN', region: 'Asia', population: 1400000000, area: 3287263, currencies: { INR: { name: 'Indian rupee', symbol: '₹' } }, languages: { hin: 'Hindi', eng: 'English' } },
    { name: { common: 'Iceland' }, cca2: 'IS', region: 'Europe', population: 370000, area: 103000, currencies: { ISK: { name: 'Icelandic króna', symbol: 'kr' } }, languages: { isl: 'Icelandic' } },
    { name: { common: 'Nowhere' }, region: 'Europe' }, // missing fields must not crash
  ].map(normalizeCountry);
  assert.deepStrictEqual(raw[0].currencies, [{ code: 'INR', name: 'Indian rupee', symbol: '₹' }]);
  assert.strictEqual(raw[0].density, Math.round((1400000000 / 3287263) * 10) / 10);
  assert.strictEqual(raw[2].density, null);
  assert.deepStrictEqual(filterCountries(raw, { region: 'Europe', minPop: 1000 }).map((c) => c.name), ['Iceland']);
  assert.deepStrictEqual(filterCountries(raw, { currency: 'INR' }).map((c) => c.code), ['IN']);
});

test('customer analytics: new vs returning, segments, list, detail', () => {
  const C = require('../src/services/customers');
  const mk = (oid, cid, date, amt) => ({ orderId: oid, customerId: cid, customerName: cid, orderDate: new Date(date), productId: 'p', productName: 'p', category: 'Books', qty: 1, price: amt, lineTotal: amt, deliveryStatus: 'Delivered', delayed: false, delayDays: 0 });
  const facts = [mk('1', 'A', '2024-01-05', 100), mk('2', 'A', '2024-02-10', 200), mk('3', 'B', '2024-02-11', 50), mk('4', 'A', '2024-02-20', 25)];
  const o = C.overview(facts, { granularity: 'month' });
  assert.deepStrictEqual(o.series.map((r) => [r.period, r.newCustomers, r.returningCustomers, r.orders]), [['2024-01', 1, 0, 1], ['2024-02', 1, 1, 3]]);
  assert.strictEqual(o.kpis.totalCustomers, 2);
  assert.strictEqual(o.kpis.repeatRate, 50);
  assert.strictEqual(o.changes.orders, 200);
  assert.strictEqual(C.periodKey('2024-01-10', 'week'), '2024-01-08'); // Wednesday -> Monday
  assert.strictEqual(C.listCustomers(facts, { sort: 'revenue' }).rows[0].customerId, 'A');
  const d = C.customerDetail(facts, 'A');
  assert.strictEqual(d.totals.revenue, 325);
  assert.strictEqual(d.segment, 'Regular');
  assert.strictEqual(C.customerDetail(facts, 'ZZ'), null);
});
