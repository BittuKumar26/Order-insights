// Accepts ISO (2024-01-31), DD-MM-YYYY, DD/MM/YYYY. Returns a Date (UTC midnight) or null.
function parseDate(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const s = String(value).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let y, mo, d;
  if (m) [, y, mo, d] = m;
  else if ((m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/))) [, d, mo, y] = m;
  else return null;
  const date = new Date(Date.UTC(+y, +mo - 1, +d));
  // reject overflow such as 2024-02-31
  return date.getUTCMonth() === +mo - 1 && date.getUTCDate() === +d ? date : null;
}

const daysBetween = (a, b) => Math.round((b - a) / 86400000);
const toISODate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

module.exports = { parseDate, daysBetween, toISODate };
