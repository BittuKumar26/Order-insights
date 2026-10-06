const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
const allowedOrigins = String(process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
if (!allowedOrigins.length && process.env.NODE_ENV !== 'production') allowedOrigins.push('http://localhost:5173');

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS origin is not allowed: ${origin}`));
  },
  exposedHeaders: ['X-Cache'],
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.text({ type: ['text/*', 'application/xml'], limit: '5mb' }));
app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
