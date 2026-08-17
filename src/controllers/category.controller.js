const pool = require('../config/db');

exports.getCategories = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, slug, description, image, parent_id, is_active, created_at FROM categories WHERE is_active = 1 ORDER BY sort_order, name'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getCategories error', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
