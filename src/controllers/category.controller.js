const { query, queryOne } = require('../config/db');

exports.getCategories = async (req, res) => {
  try {
    const categories = await query(
      `SELECT cat.id, cat.name, cat.slug, cat.description, cat.image, cat.icon,
              cat.parent_id, COUNT(c.id) AS courses_count
       FROM categories cat
       LEFT JOIN courses c ON c.category_id = cat.id AND c.status = 'PUBLISHED'
       WHERE cat.is_active = 1
       GROUP BY cat.id ORDER BY cat.sort_order ASC, cat.name ASC`
    );
    
    // Build tree structure
    const roots = categories.filter(c => !c.parent_id);
    const tree = roots.map(r => ({
      ...r,
      children: categories.filter(c => c.parent_id === r.id)
    }));
    
    res.json({ success: true, data: tree });
  } catch (err) {
    console.error('getCategories error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

exports.getCategory = async (req, res) => {
  const slug = req.params.slug;
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '12', 10);
  const offset = (page - 1) * limit;
  
  try {
    const category = await queryOne('SELECT * FROM categories WHERE slug = ? AND is_active = 1 LIMIT 1', [slug]);
    if (!category) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } });

    const [{ total }] = await query('SELECT COUNT(*) AS total FROM courses WHERE category_id = ? AND status = ?', [category.id, 'PUBLISHED']);
    const courses = await query(
      `SELECT id, title, slug, short_description, thumbnail, price, discount_price, level, duration, 
              students_count, rating_avg, lessons_count
       FROM courses WHERE category_id = ? AND status = ? ORDER BY students_count DESC LIMIT ? OFFSET ?`,
      [category.id, 'PUBLISHED', limit, offset]
    );

    return res.json({ 
      success: true, 
      data: { category, courses }, 
      meta: { total: Number(total), page, limit, pages: Math.ceil(total / limit) } 
    });
  } catch (err) {
    console.error('getCategory error', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};
