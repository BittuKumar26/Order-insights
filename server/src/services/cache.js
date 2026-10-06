const NodeCache = require('node-cache');
// analytics results are flushed on every ingest; external API results live longer
const analyticsCache = new NodeCache({ stdTTL: 120, checkperiod: 60 });
const externalCache = new NodeCache({ stdTTL: 3600, checkperiod: 300 });
module.exports = { analyticsCache, externalCache };
