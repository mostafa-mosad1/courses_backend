const { query, queryOne } = require('../config/db');

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

exports.getCourses = async (req, res) => {
  try {
    const { q, category, level, minPrice, maxPrice, free, rating, sort } = req.query;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const offset = (page - 1) * limit;

    const where = ["c.status = 'PUBLISHED'"];
    const params = [];

    if (q) {
      where.push("(c.title LIKE ? OR c.short_description LIKE ?)");
      params.push(`%${q}%`, `%${q}%`);
    }
    if (category) { where.push("cat.slug = ?"); params.push(category); }
    if (level) { where.push("c.level = ?"); params.push(level); }
    if (free === "true") where.push("c.price = 0");
    if (minPrice) { where.push("COALESCE(c.discount_price, c.price) >= ?"); params.push(Number(minPrice)); }
    if (maxPrice) { where.push("COALESCE(c.discount_price, c.price) <= ?"); params.push(Number(maxPrice)); }
    if (rating) { where.push("c.rating_avg >= ?"); params.push(Number(rating)); }

    const SORTS = {
      newest: "c.published_at DESC",
      popular: "c.students_count DESC",
      rating: "c.rating_avg DESC",
      price_asc: "COALESCE(c.discount_price, c.price) ASC",
      price_desc: "COALESCE(c.discount_price, c.price) DESC",
    };
    const orderBy = SORTS[sort] || SORTS.newest;

    const whereSql = `WHERE ${where.join(" AND ")}`;

    const [{ total }] = await query(`SELECT COUNT(*) AS total ${COURSE_JOINS} ${whereSql}`, params);
    const courses = await query(
      `SELECT ${COURSE_CARD_FIELDS} ${COURSE_JOINS} ${whereSql}
       ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ 
      success: true, 
      data: courses, 
      meta: { total: Number(total), page, limit, pages: Math.ceil(total / limit) } 
    });
  } catch (err) {
    console.error('getCourses error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

exports.getCourse = async (req, res) => {
  const ident = req.params.identifier;
  try {
    const course = await queryOne(
      `SELECT c.*, cat.name AS category_name, cat.slug AS category_slug,
              u.id AS instructor_id, u.name AS instructor_name,
              u.image AS instructor_image, u.bio AS instructor_bio
       ${COURSE_JOINS} WHERE c.slug = ? AND c.status = 'PUBLISHED' LIMIT 1`,
      [ident]
    );
    
    if (!course) {
      course = await queryOne(
        `SELECT c.*, cat.name AS category_name, cat.slug AS category_slug,
                u.id AS instructor_id, u.name AS instructor_name,
                u.image AS instructor_image, u.bio AS instructor_bio
         ${COURSE_JOINS} WHERE c.id = ? AND c.status = 'PUBLISHED' LIMIT 1`,
        [ident]
      );
    }
    
    if (!course) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Course not found' } });

    // Get curriculum
    const sections = await query(
      "SELECT id, title, sort_order FROM sections WHERE course_id = ? ORDER BY sort_order ASC",
      [course.id]
    );
    const lessons = await query(
      `SELECT l.id, l.section_id, l.title, l.type, l.duration, l.sort_order, l.is_free,
              CASE WHEN l.is_free = 1 THEN l.video_url ELSE NULL END AS video_url
       FROM lessons l
       JOIN sections s ON s.id = l.section_id
       WHERE s.course_id = ? ORDER BY l.sort_order ASC`,
      [course.id]
    );

    const curriculum = sections.map(s => ({
      ...s,
      lessons: lessons.filter(l => l.section_id === s.id)
    }));

    course.requirements = course.requirements || [];
    course.outcomes = course.outcomes || [];

    res.json({ success: true, data: { course, curriculum } });
  } catch (err) {
    console.error('getCourse error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

exports.getCourseReviews = async (req, res) => {
  const ident = req.params.identifier;
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '10', 10);
  const offset = (page - 1) * limit;
  
  try {
    const course = await queryOne("SELECT id FROM courses WHERE slug = ? LIMIT 1", [ident]);
    if (!course) course = await queryOne("SELECT id FROM courses WHERE id = ? LIMIT 1", [ident]);
    if (!course) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Course not found' } });

    const [{ total }] = await query(
      "SELECT COUNT(*) AS total FROM reviews WHERE course_id = ? AND is_approved = 1",
      [course.id]
    );
    const reviews = await query(
      `SELECT r.id, r.rating, r.comment, r.created_at,
              u.name AS user_name, u.image AS user_image
       FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.course_id = ? AND r.is_approved = 1
       ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
      [course.id, limit, offset]
    );
    
    // Rating breakdown
    const breakdown = await query(
      `SELECT rating, COUNT(*) AS count FROM reviews
       WHERE course_id = ? AND is_approved = 1 GROUP BY rating`,
      [course.id]
    );

    return res.json({ 
      success: true, 
      data: { reviews, breakdown }, 
      meta: { total: Number(total), page, limit, pages: Math.ceil(total / limit) } 
    });
  } catch (err) {
    console.error('getCourseReviews error', err);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

exports.getRelatedCourses = async (req, res) => {
  const ident = req.params.identifier;
  try {
    const course = await queryOne("SELECT id, category_id FROM courses WHERE slug = ? LIMIT 1", [ident]);
    if (!course) course = await queryOne("SELECT id, category_id FROM courses WHERE id = ? LIMIT 1", [ident]);
    if (!course) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Course not found' } });

    const courses = await query(
      `SELECT ${COURSE_CARD_FIELDS} ${COURSE_JOINS}
       WHERE c.status = 'PUBLISHED' AND c.id != ? AND c.category_id <=> ?
       ORDER BY c.students_count DESC LIMIT 4`,
      [course.id, course.category_id]
    );
    return res.json({ success: true, data: courses });
  } catch (err) {
    console.error('getRelatedCourses error', err);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};
