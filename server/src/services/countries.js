const { externalCache } = require('./cache');
const { HttpError } = require('../utils/errors');

const URL = process.env.REST_COUNTRIES_URL || 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json';
const POPULATION_URL = process.env.COUNTRY_POPULATION_URL || 'https://raw.githubusercontent.com/samayo/country-json/master/src/country-by-population.json';

// Flatten REST Countries' deeply nested JSON (currencies/languages are objects keyed by code).
function normalizeCountry(c, populationOverride) {
  const currencies = Object.entries(c.currencies || {}).map(([code, v]) => ({ code, name: v?.name || code, symbol: v?.symbol || '' }));
  const population = Number(c.population ?? populationOverride) || 0;
  const area = Number(c.area) || 0;
  return {
    name: c.name?.common || 'Unknown',
    code: c.cca2 || '',
    region: c.region || 'Other',
    population,
    area,
    density: area > 0 ? Math.round((population / area) * 10) / 10 : null, // people per km²
    currencies,
    languages: Object.values(c.languages || {}),
  };
}

async function loadCountries() {
  const hit = externalCache.get('countries');
  if (hit) return hit;
  let res;
  try {
    res = await fetch(URL, { signal: AbortSignal.timeout(10000) });
  } catch (e) {
    throw new HttpError(502, 'Could not reach the countries data source', e.message);
  }
  if (!res.ok) throw new HttpError(502, `Countries data source responded ${res.status}`);
  const payload = await res.json();
  if (!Array.isArray(payload)) {
    const providerMessage = payload?.errors?.[0]?.message;
    throw new HttpError(502, providerMessage || 'Countries data source returned an invalid response');
  }
  let populationResponse;
  try {
    populationResponse = await fetch(POPULATION_URL, { signal: AbortSignal.timeout(10000) });
  } catch (e) {
    throw new HttpError(502, 'Could not reach the country population data source', e.message);
  }
  if (!populationResponse.ok) throw new HttpError(502, `Country population source responded ${populationResponse.status}`);
  const populationRows = await populationResponse.json();
  if (!Array.isArray(populationRows)) throw new HttpError(502, 'Country population source returned an invalid response');
  const populations = new Map(populationRows.map((row) => [row.country, Number(row.population) || 0]));
  const list = payload.map((country) => normalizeCountry(country, populations.get(country.name?.common))).sort((a, b) => a.name.localeCompare(b.name));
  externalCache.set('countries', list, 86400);
  return list;
}

function filterCountries(list, { region, minPop, maxPop, currency, q }) {
  return list.filter((c) =>
    (!region || c.region === region) &&
    (minPop === undefined || c.population >= minPop) &&
    (maxPop === undefined || c.population <= maxPop) &&
    (!currency || c.currencies.some((x) => x.code === currency)) &&
    (!q || c.name.toLowerCase().includes(q.toLowerCase())));
}

module.exports = { loadCountries, filterCountries, normalizeCountry };
