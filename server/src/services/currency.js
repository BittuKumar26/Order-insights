const { externalCache } = require('./cache');

const BASE = 'INR'; // order prices are assumed to be in INR
const FALLBACK = { INR: 1, USD: 0.012, EUR: 0.011, GBP: 0.0095, AED: 0.044, JPY: 1.8 };
const SUPPORTED = Object.keys(FALLBACK);

async function getRates() {
  const hit = externalCache.get('rates');
  if (hit) return hit;
  let result;
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${BASE}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`rates API responded ${res.status}`);
    const json = await res.json();
    if (json.result !== 'success') throw new Error('rates API returned failure');
    result = { source: 'live', updatedAt: json.time_last_update_utc, rates: Object.fromEntries(SUPPORTED.map((c) => [c, json.rates[c] ?? FALLBACK[c]])) };
  } catch (err) {
    console.warn('[currency] falling back to static rates:', err.message);
    result = { source: 'fallback', updatedAt: null, rates: FALLBACK };
  }
  externalCache.set('rates', result, result.source === 'live' ? 3600 : 120); // retry sooner after a failure
  return result;
}

async function getRate(currency = BASE) {
  const code = String(currency).toUpperCase();
  const { rates, source } = await getRates();
  if (!rates[code]) return { code: BASE, rate: 1, source };
  return { code, rate: rates[code], source };
}

module.exports = { getRates, getRate, SUPPORTED, BASE };
