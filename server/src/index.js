require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/order_insights';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    const { Product, Order, Shipment, Fact } = require('./models');
    return Promise.all([Product.syncIndexes(), Order.syncIndexes(), Shipment.syncIndexes(), Fact.syncIndexes()]);
  })
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}/api`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
