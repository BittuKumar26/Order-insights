require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

function validateConfiguration() {
  const missing = ['MONGO_URI', 'JWT_SECRET'].filter((name) => !String(process.env[name] || '').trim());
  if (process.env.NODE_ENV === 'production' && !String(process.env.CLIENT_ORIGIN || '').trim()) {
    missing.push('CLIENT_ORIGIN');
  }
  if (missing.length) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }
}

async function start() {
  validateConfiguration();

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });

  const { Product, Order, Shipment, Fact } = require('./models');
  await Promise.all([Product.syncIndexes(), Order.syncIndexes(), Shipment.syncIndexes(), Fact.syncIndexes()]);
  console.log('MongoDB connected');

  const server = app.listen(PORT, HOST, () => {
    console.log(`API listening on ${HOST}:${PORT}/api`);
  });
  server.on('error', (error) => {
    console.error('HTTP server failed to start:', error);
    process.exit(1);
  });
}

start().catch((error) => {
  console.error('Backend startup failed:', error);
  process.exit(1);
});
