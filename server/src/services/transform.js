const { parseDate, daysBetween, toISODate } = require('../utils/dates');

const str = (v) => (v === undefined || v === null ? '' : String(v).trim());
// "₹1,200.50" -> 1200.5 ; garbage -> null
const num = (v) => {
  if (v === undefined || v === null || str(v) === '') return null;
  const n = typeof v === 'number' ? v : Number(str(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
// case-insensitive key lookup so "ProductID" / "productId" / "product_id" all work
const pick = (obj, ...names) => {
  const map = Object.fromEntries(Object.keys(obj || {}).map((k) => [k.toLowerCase().replace(/[_\s]/g, ''), obj[k]]));
  for (const n of names) {
    const v = map[n.toLowerCase().replace(/[_\s]/g, '')];
    if (v !== undefined) return v;
  }
  return undefined;
};

function normalizeProducts(rows) {
  const issues = [];
  const docs = [];
  rows.forEach((r, i) => {
    const productId = str(pick(r, 'productId', 'id'));
    if (!productId) return issues.push(`products row ${i + 1}: missing ProductID, skipped`);
    docs.push({
      productId,
      name: str(pick(r, 'productName', 'name')) || productId,
      category: str(pick(r, 'category')) || 'Uncategorized',
    });
  });
  return { docs, issues };
}

// Flattening happens later (buildFacts); here we only clean + type-convert order documents.
function normalizeOrders(json) {
  const issues = [];
  const list = Array.isArray(json) ? json : json?.orders;
  if (!Array.isArray(list)) return { docs: [], issues: ['payload has no "orders" array'] };
  const docs = [];
  list.forEach((o, i) => {
    const orderId = str(o.order_id ?? o.orderId ?? o.id);
    if (!orderId) return issues.push(`order #${i + 1}: missing order_id, skipped`);
    const orderDate = parseDate(o.order_date ?? o.orderDate);
    if (!orderDate) issues.push(`order ${orderId}: missing/invalid order_date`);
    if (!o.customer?.id && !o.customer?.name) issues.push(`order ${orderId}: missing customer, set to "Unknown"`);
    const items = [];
    (Array.isArray(o.items) ? o.items : []).forEach((it, j) => {
      const productId = str(it.product_id ?? it.productId);
      const qty = num(it.qty ?? it.quantity);
      const price = num(it.price);
      if (!productId) return issues.push(`order ${orderId} item ${j + 1}: missing product_id, skipped`);
      if (qty === null || qty < 0) issues.push(`order ${orderId} item ${productId}: invalid qty, treated as 0`);
      if (price === null || price < 0) issues.push(`order ${orderId} item ${productId}: invalid price, treated as 0`);
      items.push({ productId, qty: qty > 0 ? qty : 0, price: price > 0 ? price : 0 });
    });
    if (!items.length) issues.push(`order ${orderId}: has no valid items`);
    docs.push({
      orderId,
      customerId: str(o.customer?.id) || 'UNKNOWN',
      customerName: str(o.customer?.name) || 'Unknown',
      orderDate,
      items,
    });
  });
  return { docs, issues };
}

function normalizeShipments(records) {
  const issues = [];
  const docs = [];
  records.forEach((r, i) => {
    const orderId = str(pick(r, 'order_id', 'orderId'));
    if (!orderId) return issues.push(`shipment #${i + 1}: missing order_id, skipped`);
    const shipmentId = str(r['@_id'] ?? pick(r, 'shipment_id', 'shipmentId')) || `S-${orderId}`;
    const raw = { ship: pick(r, 'ship_date', 'shipDate'), exp: pick(r, 'expected_date', 'expectedDate'), del: pick(r, 'delivery_date', 'deliveryDate') };
    const shipDate = parseDate(raw.ship);
    const expectedDate = parseDate(raw.exp);
    const deliveryDate = parseDate(raw.del);
    if (str(raw.exp) && !expectedDate) issues.push(`shipment ${shipmentId}: invalid expected_date`);
    if (str(raw.del) && !deliveryDate) issues.push(`shipment ${shipmentId}: invalid delivery_date`);
    if (shipDate && deliveryDate && deliveryDate < shipDate) issues.push(`shipment ${shipmentId}: delivered before shipped (data inconsistency)`);
    docs.push({ shipmentId, orderId, carrier: str(pick(r, 'carrier')) || 'Unknown', shipDate, expectedDate, deliveryDate });
  });
  return { docs, issues };
}

// Delivery status + delay flag. `now` is injectable so results are testable.
function deliveryInfo(shipment, now = new Date()) {
  if (!shipment) return { status: 'Pending', delayed: false, delayDays: 0 };
  const { expectedDate: exp, deliveryDate: del } = shipment;
  if (del) {
    const late = exp ? daysBetween(exp, del) : 0;
    return late > 0 ? { status: 'Delayed', delayed: true, delayDays: late, overdue: false } : { status: 'Delivered', delayed: false, delayDays: 0, overdue: false };
  }
  if (exp && now > exp) return { status: 'Delayed', delayed: true, delayDays: daysBetween(exp, now), overdue: true }; // overdue, not yet delivered
  return { status: 'In Transit', delayed: false, delayDays: 0 };
}

// Join orders + items + products + shipments into flat order-line "facts".
function buildFacts(orders, products, shipments, now = new Date()) {
  const productMap = new Map(products.map((p) => [p.productId, p]));
  const shipMap = new Map(shipments.map((s) => [s.orderId, s]));
  const facts = [];
  for (const o of orders) {
    const d = deliveryInfo(shipMap.get(o.orderId), now);
    const ship = shipMap.get(o.orderId);
    for (const it of o.items) {
      const p = productMap.get(it.productId);
      facts.push({
        orderId: o.orderId,
        orderDate: o.orderDate,
        customerId: o.customerId,
        customerName: o.customerName,
        productId: it.productId,
        productName: p?.name || it.productId,
        category: p?.category || 'Uncategorized',
        qty: it.qty,
        price: it.price,
        lineTotal: Math.round(it.qty * it.price * 100) / 100,
        deliveryStatus: d.status,
        delayed: d.delayed,
        delayDays: d.delayDays,
        overdue: !!d.overdue,
        carrier: ship?.carrier || null,
      });
    }
  }
  return facts;
}

module.exports = { normalizeProducts, normalizeOrders, normalizeShipments, deliveryInfo, buildFacts, toISODate };
