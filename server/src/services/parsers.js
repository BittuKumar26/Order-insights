const { XMLParser } = require('fast-xml-parser');
const { parse: csvParse } = require('csv-parse/sync');
const { HttpError } = require('../utils/errors');

// Some exports (like the sample Orders.json / Products.csv) have every line wrapped in quotes with
// inner quotes doubled, as if the file had been saved through a spreadsheet. Undo that wrapping.
function unwrapQuotedLines(text) {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => {
      const t = line.trim();
      return t.length > 1 && t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1).replace(/""/g, '"') : line;
    })
    .join('\n');
}

function parseJson(input) {
  if (input && typeof input === 'object') return input;
  const text = String(input ?? '').replace(/^\uFEFF/, '');
  try {
    return JSON.parse(text);
  } catch {
    try {
      return JSON.parse(unwrapQuotedLines(text));
    } catch (e) {
      throw new HttpError(400, 'Invalid JSON payload', e.message);
    }
  }
}

const csvOpts = { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true, bom: true };

function parseCsv(input) {
  const text = String(input ?? '');
  try {
    let rows = csvParse(text, csvOpts);
    // Whole-line quoting collapses everything into a single column -> repair and re-parse.
    if (rows.length && Object.keys(rows[0]).length === 1 && Object.keys(rows[0])[0].includes(',')) {
      rows = csvParse(unwrapQuotedLines(text), csvOpts);
    } else if (!rows.length && text.includes(',')) {
      rows = csvParse(unwrapQuotedLines(text), csvOpts);
    }
    return rows;
  } catch (e) {
    throw new HttpError(400, 'Invalid CSV payload', e.message);
  }
}

const asArray = (x) => (x === undefined || x === null ? [] : Array.isArray(x) ? x : [x]);

// Returns an array of objects for each <recordTag> found anywhere under the root.
function parseXml(input, recordTag = 'shipment') {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: false, // keep strings; we do our own type conversion
    trimValues: true,
    isArray: (name) => name === recordTag,
  });
  let doc;
  try {
    doc = parser.parse(String(input ?? ''));
  } catch (e) {
    throw new HttpError(400, 'Invalid XML payload', e.message);
  }
  const found = [];
  (function walk(node) {
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      if (k === recordTag) asArray(v).forEach((r) => found.push(typeof r === 'object' ? r : { value: r }));
      else walk(v);
    }
  })(doc);
  if (!found.length) throw new HttpError(400, `No <${recordTag}> records found in XML`);
  return found;
}

module.exports = { parseJson, parseCsv, parseXml, unwrapQuotedLines };
