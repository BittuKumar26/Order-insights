const fs = require('fs/promises');
const path = require('path');
const { Product, Order, Shipment, Fact } = require('../models');
const { parseJson, parseCsv, parseXml } = require('./parsers');
const { normalizeProducts, normalizeOrders, normalizeShipments, buildFacts } = require('./transform');
const { analyticsCache } = require('./cache');

const upsertAll = async (Model, docs, key, ownerId) => {
  if (!docs.length) return { inserted: 0, updated: 0 };
  const r = await Model.bulkWrite(docs.map((d) => ({ updateOne: { filter: { ownerId, [key]: d[key] }, update: { $set: { ...d, ownerId } }, upsert: true } })));
  return { inserted: r.upsertedCount, updated: r.matchedCount };
};

// Re-derive the read model from the three source collections. Datasets can arrive in any order,
// so every ingest rebuilds the joins. Fine for this volume; at scale use incremental updates.
async function rebuildFacts(ownerId) {
  const sourceFilter = { ownerId };
  const [products, orders, shipments] = await Promise.all([Product.find(sourceFilter).lean(), Order.find(sourceFilter).lean(), Shipment.find(sourceFilter).lean()]);
  const facts = buildFacts(orders, products, shipments);
  await Fact.deleteMany(sourceFilter);
  if (facts.length) await Fact.insertMany(facts.map((fact) => ({ ...fact, ownerId })), { ordered: false });
  analyticsCache.flushAll();
  return facts.length;
}

const DATASETS = {
  products: { Model: Product, key: 'productId', run: (p) => normalizeProducts(Array.isArray(p) ? p : parseCsv(p)) },
  orders: { Model: Order, key: 'orderId', run: (p) => normalizeOrders(parseJson(p)) },
  shipments: { Model: Shipment, key: 'orderId', run: (p) => normalizeShipments(parseXml(p, 'shipment')) },
};

async function ingest(dataset, payload, ownerId, { replace = true } = {}) {
  const d = DATASETS[dataset];
  const { docs, issues } = d.run(payload);
  if (replace && docs.length) await d.Model.deleteMany({ ownerId });
  const stats = await upsertAll(d.Model, docs, d.key, ownerId);
  const facts = await rebuildFacts(ownerId);
  return { dataset, received: docs.length, ...stats, skippedOrWarned: issues.length, issues: issues.slice(0, 50), factRows: facts };
}

const SAMPLE_FILES = [
  ['products', 'Products.csv'], ['products', 'Products_extended.csv'],
  ['orders', 'Orders.json'], ['orders', 'Orders_extended.json'],
  ['shipments', 'Shipments.xml'],
];

async function loadSamples(ownerId) {
  const results = [];
  await Promise.all([Product.deleteMany({ ownerId }), Order.deleteMany({ ownerId }), Shipment.deleteMany({ ownerId }), Fact.deleteMany({ ownerId })]);
  for (const [dataset, file] of SAMPLE_FILES) {
    const text = await fs.readFile(path.join(__dirname, '../../data', file), 'utf8');
    const r = await ingest(dataset, text, ownerId, { replace: false });
    results.push({ file, ...r });
  }
  return results;
}

module.exports = { ingest, loadSamples, rebuildFacts };
