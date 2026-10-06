const { Fact } = require('../models');
const { HttpError } = require('../utils/errors');
const { parseDate } = require('../utils/dates');

const STATUSES = ['Delivered', 'In Transit', 'Delayed', 'Pending'];

// Validate query-string filters and turn them into a Mongo match document.
function parseFilters(q) {
  const filter = {};
  const out = {};
  if (q.from || q.to) {
    const from = q.from ? parseDate(q.from) : null;
    const to = q.to ? parseDate(q.to) : null;
    if ((q.from && !from) || (q.to && !to)) throw new HttpError(400, 'from/to must be valid dates (YYYY-MM-DD)');
    if (from && to && from > to) throw new HttpError(400, '"from" must be before "to"');
    filter.orderDate = {};
    if (from) filter.orderDate.$gte = from;
    if (to) filter.orderDate.$lte = to;
    Object.assign(out, { from: q.from, to: q.to });
  }
  if (q.category) { filter.category = String(q.category); out.category = q.category; }
  if (q.status) {
    if (!STATUSES.includes(q.status)) throw new HttpError(400, `status must be one of: ${STATUSES.join(', ')}`);
    filter.deliveryStatus = q.status;
    out.status = q.status;
  }
  return { filter, applied: out };
}

const fetchFacts = (ownerId, filter = {}) => Fact.find({ ownerId, ...filter }).lean();

module.exports = { parseFilters, fetchFacts, STATUSES };
