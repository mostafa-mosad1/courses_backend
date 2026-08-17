const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

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
