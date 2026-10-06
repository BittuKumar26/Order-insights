const notFound = (req, res) => res.status(404).json({ success: false, error: { message: `Route not found: ${req.method} ${req.originalUrl}` } });

// Single place where every error becomes the standard envelope.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  if (err.name === 'MulterError') status = 400;
  if (err.type === 'entity.parse.failed') status = 400;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({
    success: false,
    error: { message: status === 500 ? 'Internal server error' : err.message, ...(err.details ? { details: err.details } : {}) },
  });
};
module.exports = { notFound, errorHandler };
