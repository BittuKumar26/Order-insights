const { verify } = require('../services/auth');

function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ success: false, error: { message: 'Authentication required' } });
  try {
    req.user = verify(token);
    return next();
  } catch {
    return res.status(401).json({ success: false, error: { message: 'Invalid or expired session' } });
  }
}

const requireRole = (role) => (req, res, next) => {
  if (req.user?.role !== role) return res.status(403).json({ success: false, error: { message: 'You do not have access to this area' } });
  next();
};

module.exports = { requireAuth, requireRole };
