// Deterministic generator for extra demo data: Products_extended.csv, Orders_extended.json, Shipments.xml
// (Shipments.xml lives in the shared Drive folder in the original exercise, so we synthesise it here.)
const fs = require('fs');
const path = require('path');

let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

const products = [
  ['P101', 500], ['P102', 1200], ['P103', 200],
  ['P104', 2500], ['P105', 800], ['P106', 1800], ['P107', 350], ['P108', 7500], ['P109', 15000], ['P110', 120],
];
const extraProducts = [
  ['P104', 'Headphones', 'Electronics'], ['P105', 'T-Shirt', 'Clothing'], ['P106', 'Jeans', 'Clothing'],
  ['P107', 'Novel', 'Books'], ['P108', 'Office Desk', 'Furniture'], ['P109', 'Tablet', 'Electronics'], ['P110', 'Notebook', 'Books'],
];
const NAMES = ['Rahul','Anita','Vikram','Meera','Sanjay','Priya','Karan','Neha','Arjun','Kavya','Rohan','Sneha','Amit','Pooja','Nikhil','Divya','Manish','Ritu','Sahil','Isha','Varun','Tanvi','Deepak','Simran','Harsh','Nisha','Aditya','Swati','Gaurav','Ananya','Mohit','Shreya','Yash','Komal','Tarun','Bhavna','Kunal','Sakshi','Rajat','Payal'];
const customers = NAMES.map((n, i) => ['C' + String(i + 1).padStart(3, '0'), n]);
const carriers = ['BlueDart', 'Delhivery', 'DTDC', 'Ecom Express'];

const out = path.join(__dirname, '../data');
fs.writeFileSync(path.join(out, 'Products_extended.csv'), 'ProductID,ProductName,Category\n' + extraProducts.map((p) => p.join(',')).join('\n') + '\n');

const orders = [];
const start = new Date('2024-01-03T00:00:00Z');
for (let i = 0; i < 90; i++) {
  const date = addDays(start, Math.floor((i / 90) * 270) + int(0, 2)); // Jan -> Sep 2024, gentle growth
  const [cid, cname] = pick(customers);
  const items = Array.from({ length: int(1, 3) }, () => {
    const [pid, base] = pick(products);
    return { product_id: pid, qty: int(1, 4), price: Math.round(base * (0.92 + rnd() * 0.16)) };
  });
  orders.push({ order_id: String(1003 + i), customer: { id: cid, name: cname }, items, order_date: iso(date) });
}
// deliberately dirty records to exercise the cleaning logic
orders[3].items[0].qty = '3';                    // string qty
orders[7].items[0].price = '₹1,200';              // currency-formatted price
orders[11].items[0].price = null;                 // missing price
orders[15].items.push({ product_id: 'P999', qty: 1, price: 999 }); // unknown product -> Uncategorized
orders[19].order_date = '15/04/2024';             // DD/MM/YYYY
orders[23].order_date = 'not-a-date';             // invalid date
delete orders[27].customer;                       // missing customer
fs.writeFileSync(path.join(out, 'Orders_extended.json'), JSON.stringify({ orders }, null, 2));

const allOrders = [{ order_id: '1001', order_date: '2024-01-01' }, { order_id: '1002', order_date: '2024-01-02' }, ...orders];
let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<shipments>\n';
let sid = 5001;
allOrders.forEach((o, idx) => {
  if (idx % 17 === 16) return;                    // a few orders never shipped -> "Pending"
  const od = new Date(o.order_date.includes('/') || o.order_date === 'not-a-date' ? '2024-04-15' : o.order_date);
  const ship = addDays(od, int(0, 2));
  const expected = addDays(ship, int(3, 6));
  const r = rnd();
  const delivered = r < 0.88 ? addDays(expected, r < 0.25 ? int(1, 5) : int(-2, 0)) : null; // ~25% late, ~12% never delivered
  xml += `  <shipment id="S${sid++}">\n    <order_id>${o.order_id}</order_id>\n    <carrier>${pick(carriers)}</carrier>\n    <ship_date>${iso(ship)}</ship_date>\n    <expected_date>${idx % 29 === 5 ? '' : iso(expected)}</expected_date>\n`;
  if (delivered) xml += `    <delivery_date>${iso(delivered)}</delivery_date>\n`;
  xml += '  </shipment>\n';
});
xml += '</shipments>\n';
fs.writeFileSync(path.join(out, 'Shipments.xml'), xml);
console.log('generated', orders.length, 'extra orders');
