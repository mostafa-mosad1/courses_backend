const { query } = require('../config/db');

const COURSE_CARD_FIELDS = `
  c.id, c.title, c.slug, c.short_description, c.thumbnail,
  c.price, c.discount_price, c.level, c.language, c.duration,
  c.lessons_count, c.students_count, c.rating_avg, c.reviews_count, c.created_at,
  cat.name AS category_name, cat.slug AS category_slug,
  u.id AS instructor_id, u.name AS instructor_name, u.image AS instructor_image
`;

const COURSE_JOINS = `
  FROM courses c
  LEFT JOIN categories cat ON cat.id = c.category_id
  LEFT JOIN users u ON u.id = c.instructor_id
`;

exports.home = async (req, res) => {
  try {
    const featured = await query(
      `SELECT ${COURSE_CARD_FIELDS} ${COURSE_JOINS}
       WHERE c.status = 'PUBLISHED' AND c.is_featured = 1
       ORDER BY c.students_count DESC LIMIT 8`
    );
    const latest = await query(
      `SELECT ${COURSE_CARD_FIELDS} ${COURSE_JOINS}
       WHERE c.status = 'PUBLISHED'
       ORDER BY c.published_at DESC LIMIT 8`
    );
    const categories = await query(
      `SELECT cat.id, cat.name, cat.slug, cat.icon, cat.image,
              COUNT(c.id) AS courses_count
       FROM categories cat
       LEFT JOIN courses c ON c.category_id = cat.id AND c.status = 'PUBLISHED'
       WHERE cat.is_active = 1 AND cat.parent_id IS NULL
       GROUP BY cat.id ORDER BY cat.sort_order ASC LIMIT 8`
    );
    const [stats] = await query(
      `SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'STUDENT') AS students,
        (SELECT COUNT(*) FROM courses WHERE status = 'PUBLISHED') AS courses,
        (SELECT COUNT(*) FROM certificates) AS certificates`
    );

    return res.json({ success: true, data: { featured, latest, categories, stats } });
  } catch (err) {
    console.error('home error', err);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

exports.search = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ success: true, data: { courses: [], categories: [] } });

    const courses = await query(
      `SELECT c.id, c.title, c.slug, c.thumbnail, c.price, c.discount_price
       FROM courses c WHERE c.status = 'PUBLISHED' AND c.title LIKE ? LIMIT 6`,
      [`%${q}%`]
    );

    const categories = await query(
      `SELECT id, name, slug FROM categories WHERE is_active = 1 AND name LIKE ? LIMIT 4`,
      [`%${q}%`]
    );

    return res.json({ success: true, data: { courses, categories } });
  } catch (err) {
    console.error('search error', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};
