const pool = require('../config/db');

exports.search = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ success: true, data: { courses: [], categories: [] } });

    const [courses] = await pool.query(
      `SELECT id, title, slug, thumbnail, price, discount_price FROM courses WHERE status = 'PUBLISHED' AND title LIKE ? LIMIT 6`,
      [`%${q}%`]
    );

    const [categories] = await pool.query(
      `SELECT id, name, slug FROM categories WHERE is_active = 1 AND name LIKE ? LIMIT 4`,
      [`%${q}%`]
    );

    return res.json({ success: true, data: { courses, categories } });
  } catch (err) {
    console.error('public.search error', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};
