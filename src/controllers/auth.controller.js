const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function setAuthCookie(res, token) {
  try {
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  } catch (e) {
    // ignore cookie failures (e.g., headers already sent)
  }
}

function clearAuthCookie(res) {
  try {
    res.clearCookie('token', { path: '/' });
  } catch (e) { /* ignore */ }
}

function extractToken(req) {
  if (req.cookies && req.cookies.token) return req.cookies.token;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

exports.me = async (req, res) => {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });
    let decoded;
    try { decoded = jwt.verify(token, JWT_SECRET); } catch (e) { return res.status(401).json({ success: false, error: 'Invalid token' }); }

    const [rows] = await pool.query(
      'SELECT id, name, email, image, role, is_active, created_at FROM users WHERE id = ? LIMIT 1',
      [decoded.id]
    );
    const user = rows && rows[0];
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    return res.json({ success: true, data: { user } });
  } catch (err) {
    console.error('me error', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

exports.register = async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, error: 'Missing fields' });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    const id = randomUUID();
    await pool.query('INSERT INTO users (id, name, email, password) VALUES (?,?,?,?)', [id, name, email, hashed]);
    res.json({ success: true, data: { id, name, email } });
  } catch (err) {
    console.error(err);
    if (err && err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, error: 'Email already exists' });
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

  exports.login = async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ success: false, error: 'Missing fields' });

    try {
      const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email.toLowerCase().trim()]);
      const user = rows && rows[0];
      if (!user || !user.password) return res.status(401).json({ success: false, error: 'Invalid credentials' });
      if (user.is_active === 0) return res.status(403).json({ success: false, error: 'Account suspended' });

      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).json({ success: false, error: 'Invalid credentials' });

      const token = signToken({ id: user.id, role: user.role });
      setAuthCookie(res, token);

      const publicUser = { id: user.id, name: user.name, email: user.email, role: user.role, image: user.image };
      return res.json({ success: true, data: { token, user: publicUser } });
    } catch (err) {
      console.error('login error', err && err.message ? err.message : err);
      return res.status(500).json({ success: false, error: 'Server error' });
    }
  };

  exports.logout = async (req, res) => {
    try {
      clearAuthCookie(res);
      return res.json({ success: true, data: { message: 'Logged out' } });
    } catch (err) {
      console.error('logout error', err && err.message ? err.message : err);
      return res.status(500).json({ success: false, error: 'Server error' });
    }
  };

  // POST /api/auth/forgot-password
  exports.forgotPassword = async (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ success: false, error: 'Missing email' });
    try {
      const [rows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email.toLowerCase().trim()]);
      const user = rows && rows[0];
      if (!user) {
        // Do not reveal whether email exists
        return res.json({ success: true, data: { message: 'If the email exists, a reset link was sent' } });
      }

      const token = randomUUID();
      const id = randomUUID();
      await pool.query(
        `INSERT INTO verification_tokens (id, user_id, token, type, expires_at)
         VALUES (?, ?, ?, 'PASSWORD_RESET', DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
        [id, user.id, token]
      );

      // In a real app you'd email the token; for now log it so developer can copy it
      console.log('Password reset token for', email, token);

      return res.json({ success: true, data: { message: 'If the email exists, a reset link was sent' } });
    } catch (err) {
      console.error('forgotPassword error', err && err.message ? err.message : err);
      return res.status(500).json({ success: false, error: 'Server error' });
    }
  };

  // POST /api/auth/reset-password
  exports.resetPassword = async (req, res) => {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ success: false, error: 'Missing token or password' });
    try {
      const [rows] = await pool.query(
        'SELECT * FROM verification_tokens WHERE token = ? AND type = ? AND used_at IS NULL AND expires_at > NOW() LIMIT 1',
        [token, 'PASSWORD_RESET']
      );
      const vt = rows && rows[0];
      if (!vt) return res.status(400).json({ success: false, error: 'Invalid or expired token' });

      const hashed = await bcrypt.hash(password, 10);
      await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, vt.user_id]);
      await pool.query('UPDATE verification_tokens SET used_at = NOW() WHERE id = ?', [vt.id]);

      return res.json({ success: true, data: { message: 'Password reset successful' } });
    } catch (err) {
      console.error('resetPassword error', err && err.message ? err.message : err);
      return res.status(500).json({ success: false, error: 'Server error' });
    }
  };
