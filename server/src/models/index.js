const mongoose = require('mongoose');
const { Schema } = mongoose;

const Product = mongoose.model('Product', new Schema({
  ownerId: { type: String, required: true, index: true },
  productId: { type: String, required: true },
  name: String,
  category: { type: String, index: true },
}, { timestamps: true }));
Product.schema.index({ ownerId: 1, productId: 1 }, { unique: true });

const Order = mongoose.model('Order', new Schema({
  ownerId: { type: String, required: true, index: true },
  orderId: { type: String, required: true },
  customerId: String,
  customerName: String,
  orderDate: Date,
  items: [{ _id: false, productId: String, qty: Number, price: Number }],
}, { timestamps: true }));
Order.schema.index({ ownerId: 1, orderId: 1 }, { unique: true });

const Shipment = mongoose.model('Shipment', new Schema({
  ownerId: { type: String, required: true, index: true },
  shipmentId: { type: String, required: true },
  orderId: { type: String, required: true, index: true }, // one shipment per order
  carrier: String,
  shipDate: Date,
  expectedDate: Date,
  deliveryDate: Date,
}, { timestamps: true }));
Shipment.schema.index({ ownerId: 1, orderId: 1 }, { unique: true });

// Denormalised order-line "fact" rows: the joined, flattened, derived read model used by analytics.
const Fact = mongoose.model('Fact', new Schema({
  ownerId: { type: String, required: true, index: true },
  orderId: { type: String, index: true },
  orderDate: { type: Date, index: true },
  customerId: String,
  customerName: String,
  productId: String,
  productName: String,
  category: { type: String, index: true },
  qty: Number,
  price: Number,
  lineTotal: Number,
  deliveryStatus: { type: String, index: true },
  delayed: Boolean,
  delayDays: Number,
  overdue: Boolean,
  carrier: String,
}, { versionKey: false }));
Fact.schema.index({ ownerId: 1, orderId: 1 });

const User = mongoose.model('User', new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
}, { timestamps: true }));

module.exports = { Product, Order, Shipment, Fact, User };
