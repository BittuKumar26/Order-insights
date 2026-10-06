const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const secret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return process.env.JWT_SECRET;
};

const publicUser = (user) => ({ id: user._id.toString(), name: user.name, email: user.email, role: user.role });

async function register({ name, email, password }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!name?.trim() || !normalizedEmail || !password || password.length < 8) {
    const error = new Error('Name, email, and a password of at least 8 characters are required');
    error.status = 400;
    throw error;
  }
  const exists = await User.exists({ email: normalizedEmail });
  if (exists) {
    const error = new Error('An account with this email already exists');
    error.status = 409;
    throw error;
  }
  const user = await User.create({ name: name.trim(), email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12), role: 'user' });
  return issue(user);
}

async function login({ email, password }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  let user = await User.findOne({ email: normalizedEmail });
  const isConfiguredAdmin = normalizedEmail === String(process.env.ADMIN_EMAIL || '').trim().toLowerCase()
    && password === process.env.ADMIN_PASSWORD;
  if (!user && isConfiguredAdmin) {
    user = await User.create({ name: process.env.ADMIN_NAME || 'User', email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12), role: 'user' });
  }
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
    const error = new Error('Invalid email or password');
    error.status = 401;
    throw error;
  }
  if (user.role !== 'user') {
    user.role = 'user';
    await user.save();
  }
  return issue(user);
}

function issue(user) {
  const userData = publicUser(user);
  return { token: jwt.sign(userData, secret(), { expiresIn: '8h' }), user: userData };
}

function verify(token) {
  return jwt.verify(token, secret());
}

module.exports = { register, login, verify };
