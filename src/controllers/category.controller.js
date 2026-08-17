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

exports.getCategory = async (req, res) => {
  const slug = req.params.slug;
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '12', 10);
  const offset = (page - 1) * limit;
  try {
    const [[category]] = await pool.query('SELECT * FROM categories WHERE slug = ? AND is_active = 1 LIMIT 1', [slug]);
    if (!category) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } });

    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM courses WHERE category_id = ? AND status = ?', [category.id, 'PUBLISHED']);
    const [courses] = await pool.query(
      `SELECT id, title, slug, short_description, thumbnail, price, discount_price, level, duration, students_count, rating_avg
       FROM courses WHERE category_id = ? AND status = ? ORDER BY students_count DESC LIMIT ? OFFSET ?`,
      [category.id, 'PUBLISHED', limit, offset]
    );

    return res.json({ success: true, data: { category, courses, meta: { total: Number(total), page, limit } } });
  } catch (err) {
    console.error('getCategory error', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};
