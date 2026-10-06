# Order Insights — MERN data-pipeline + analytics dashboard

MongoDB · Express · React (Vite, Redux Toolkit, Recharts) · Node 18+

## Run
```bash
npm run install:all
# MongoDB must be running locally (or set MONGO_URI in server/.env)
npm run server      # API  -> http://localhost:5000/api
npm run client      # UI   -> http://localhost:5173
npm test            # backend unit tests (no DB needed)
```
Open the UI → **Data Ingest → Load sample data**, then go to **Dashboard**.

## Authentication
The UI starts at `/login`. New accounts can register as users. Any authenticated account can use the dashboard, view analytics, upload orders/products/shipments, and reset or load sample data.

Set `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `server/.env` for the built-in local login credentials. All accounts are treated as users; the configured credentials are only a convenient initial login and are not an elevated admin role. Passwords are hashed with bcrypt before being stored in MongoDB, and sessions use eight-hour signed bearer tokens.

Uploaded products, orders, shipments, derived facts, analytics, and reset operations are scoped to the authenticated account. One user cannot see or delete another user's data.

Uploading a file replaces that authenticated user's previous dataset of the same type; it does not merge stale rows from an earlier upload. Loading sample data clears that user's existing data first and then loads the complete sample set.

## Input files
| File | Used as |
|---|---|
| `Orders.json`, `Products.csv` (yours) | ingested as-is; both are quote-wrapped on every line, the parsers auto-repair this |
| `Shipments.xml` | **not in the upload** (it's in the Drive folder) → synthesised by `npm run gen:data --prefix server`; drop your real file in via the UI or `POST /api/ingest/xml` |
| `Orders_extended.json`, `Products_extended.csv` | generated extra data (incl. deliberately dirty rows) so charts have substance |
| `Hit_External_API.xlsx` | REST Countries API → Countries page + `/api/meta/countries`; exchange-rate API (open.er-api.com) → currency conversion |
| `Excercise.docx` | requirements + dashboard mockups → UI layout (sidebar, pastel KPI cards, line/pie/bar charts) |

## API (all responses: `{ success, data, meta }` / `{ success:false, error }`)
- `POST /api/ingest/json | xml | csv` — multipart `file` or raw body (`?dataset=` overrides target)
- Add `?async=true` to any ingest call → `202 { jobId }`; poll `GET /api/ingest/jobs/:id` (queued → running → done/failed)
- `POST /api/ingest/samples`, `DELETE /api/ingest/reset`
- `GET /api/analytics/summary?from&to&category&status&currency&granularity` → KPIs, trend, byCategory, delivery, topCustomers
- `GET /api/analytics/category/:category` → product drill-down
- `GET /api/orders?page&limit&sort&dir&q&...filters` (server-side pagination)
- `GET /api/products`, `/api/meta/filters`, `/api/meta/rates`, `/api/meta/countries`

## Dashboard
- **Order Insights dashboard** (`/`) — orders, revenue, delivery, filters, category drill-down, products, countries, and data ingestion.

## Design decisions
- **Storage: MongoDB** (required by MERN). Raw collections `products`, `orders`, `shipments` + a denormalised `facts` collection (one row per order line: joined, flattened, delivery flag derived). Rebuilt after every ingest, so datasets can arrive in any order.
- **Layers:** parsers → transform (clean/join/derive) → analytics (pure functions) → controllers → routes. Transform + analytics are DB-free and unit-tested.
- **Cleaning:** type conversion (`"3"`, `"₹1,200"`), missing price/qty → 0, unknown product → `Uncategorized`, missing customer → `Unknown`, multiple date formats, invalid dates reported; every ingest returns a list of warnings.
- **Derived:** total order value, delay flag (late delivery *or* overdue and undelivered), delay days, category aggregation, currency conversion.
- **Delivery status:** Delivered / Delayed / In Transit / Pending (no shipment).
- **Caching:** node-cache — analytics (flushed on ingest, `X-Cache` header), rates (1h), countries (24h). Rates fall back to static values if the API is unreachable.
- **Frontend:** Redux Toolkit holds filters/metric/currency; thunks give loading + error + abort-on-change; `useFetch` hook for simple pages; responsive layout with collapsible sidebar.
- **Drill-down:** click a category bar → product table; click a pie slice → filters by status.

## Verification status
- 14 backend unit tests (`npm test`): parsers incl. the malformed sample files, cleaning, joins, delay logic, totals, currency, pagination, async jobs, REST Countries flattening.
- Full API exercised end-to-end against a MongoDB-compatible server (FerretDB): async sample load, summary/filters/drill-down/orders/products, caching (`X-Cache` MISS→HIT), validation + error responses.
- UI driven in a headless browser: dashboard render, category drill-down, Revenue/Orders toggle, status filter, currency switch, orders pagination, mobile layout (no horizontal scroll, no JS errors).
- **Not verifiable in the build sandbox:** live calls to restcountries.com and open.er-api.com (hosts were blocked). Rates fall back to static values; the Countries page shows the API error with a Retry button. Run it on your machine to see live data.
- The Countries page uses public GitHub country metadata and population datasets by default because the unauthenticated REST Countries `v3.1` endpoint was deprecated. Override `REST_COUNTRIES_URL` and `COUNTRY_POPULATION_URL` in `server/.env` if needed.
- Tested on FerretDB, not a real `mongod` — queries were kept to basic operations (find/distinct/bulkWrite) so they behave the same on MongoDB.

## Known limits / next steps
- Analytics aggregate in JS after a filtered Mongo query (fine for thousands of orders; move to `$group` pipelines for millions).
- The async job queue is in-memory (jobs are lost on restart); use BullMQ/Redis for durability or multiple workers.
- `avgDelayDays` covers shipments that arrived late; undelivered-and-overdue orders are counted as delayed but reported separately (`overdueOrders`).
- `Shipments.xml` is synthetic — upload your real one from the Drive folder.
