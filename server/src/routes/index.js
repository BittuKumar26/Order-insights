const router = require('express').Router();
const multer = require('multer');
const c = require('../controllers');
const { requireAuth } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/health', c.health);
router.post('/auth/register', c.register);
router.post('/auth/login', c.login);
router.get('/auth/me', requireAuth, c.me);

// Ingestion — each accepts multipart "file" or a raw body
router.post('/ingest/json', requireAuth, upload.single('file'), c.ingestAs('orders'));
router.post('/ingest/xml', requireAuth, upload.single('file'), c.ingestAs('shipments'));
router.post('/ingest/csv', requireAuth, upload.single('file'), c.ingestAs('products'));
router.post('/ingest/samples', requireAuth, c.samples);
router.get('/ingest/jobs/:id', requireAuth, c.jobStatus);
router.delete('/ingest/reset', requireAuth, c.reset);

// Analytics + data
router.get('/analytics/summary', requireAuth, c.summary);
router.get('/analytics/category/:category', requireAuth, c.categoryDetail);
router.get('/users/overview', requireAuth, c.userOverview);
router.get('/users', requireAuth, c.userList);
router.get('/users/:id', requireAuth, c.userDetail);
router.get('/orders', requireAuth, c.orders);
router.get('/products', requireAuth, c.products);

// Metadata + external APIs
router.get('/meta/filters', requireAuth, c.filterOptions);
router.get('/meta/rates', requireAuth, c.rates);
router.get('/meta/countries', requireAuth, c.countries);

module.exports = router;
