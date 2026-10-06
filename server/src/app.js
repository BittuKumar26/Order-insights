const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', exposedHeaders: ['X-Cache'] }));
app.use(express.json({ limit: '5mb' }));
app.use(express.text({ type: ['text/*', 'application/xml'], limit: '5mb' }));
app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
