const { query, queryOne, execute } = require('../config/db');
const { randomUUID } = require('crypto');

// GET /api/instructor/profile
exports.getInstructorProfile = async (req, res) => {
  try {
    const user = await queryOne(
      `SELECT id, name, email, image, bio, phone, role, locale,
              email_notifications, email_verified_at, created_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    
    // Get instructor's courses count
    const [{ courses_count }] = await query(
      "SELECT COUNT(*) AS courses_count FROM courses WHERE instructor_id = ?",
      [req.user.id]
    );
    
    // Get instructor's students count
    const [{ students_count }] = await query(
      `SELECT COUNT(DISTINCT e.user_id) AS students_count
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       WHERE c.instructor_id = ?`,
      [req.user.id]
    );
    
    res.json({ success: true, data: { ...user, courses_count, students_count } });
  } catch (err) {
    console.error('getInstructorProfile error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// GET /api/instructor/courses
exports.getInstructorCourses = async (req, res) => {
  try {
    const { status } = req.query;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const offset = (page - 1) * limit;

    let whereSql = 'WHERE instructor_id = ?';
    const params = [req.user.id];
    
    if (status && ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status.toUpperCase())) {
      whereSql += ' AND status = ?';
      params.push(status.toUpperCase());
    }

    const [{ total }] = await query(`SELECT COUNT(*) AS total FROM courses ${whereSql}`, params);
    const courses = await query(
      `SELECT c.id, c.title, c.slug, c.status, c.price, c.discount_price, c.level,
              c.students_count, c.rating_avg, c.reviews_count, c.lessons_count, c.duration,
              c.created_at, c.published_at,
              cat.name AS category_name
       FROM courses c
       LEFT JOIN categories cat ON cat.id = c.category_id
       ${whereSql}
       ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ success: true, data: courses, meta: { total: Number(total), page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('getInstructorCourses error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// POST /api/instructor/courses
exports.createInstructorCourse = async (req, res) => {
  try {
    const { title, slug, short_description, description, thumbnail, preview_video, price, discount_price, level, language, category_id, requirements, outcomes } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'title مطلوب' } });
    }

    // Generate slug from title if not provided
    const courseSlug = slug || title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');

    const id = randomUUID();
    // Instructor can only create DRAFT courses - admin must approve to publish
    await execute(
      `INSERT INTO courses (id, title, slug, short_description, description, thumbnail, preview_video,
                           price, discount_price, level, language, status, category_id, instructor_id,
                           requirements, outcomes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, NOW(), NOW())`,
      [id, title, courseSlug, short_description, description, thumbnail, preview_video,
       price || 0, discount_price || null, level || 'BEGINNER', language || 'ar', category_id, req.user.id,
       requirements ? JSON.stringify(requirements) : null, outcomes ? JSON.stringify(outcomes) : null]
    );

    const course = await queryOne("SELECT * FROM courses WHERE id = ?", [id]);
    res.json({ success: true, data: course });
  } catch (err) {
    console.error('createInstructorCourse error', err);
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, error: { code: 'CONFLICT', message: 'Slug مستخدم بالفعل' } });
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// GET /api/instructor/courses/:id
exports.getInstructorCourse = async (req, res) => {
  try {
    const course = await queryOne(
      "SELECT * FROM courses WHERE id = ? AND instructor_id = ?",
      [req.params.id, req.user.id]
    );
    if (!course) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'الكورس غير موجود أو مش ملكك' } });
    }
    res.json({ success: true, data: course });
  } catch (err) {
    console.error('getInstructorCourse error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// PATCH /api/instructor/courses/:id
exports.updateInstructorCourse = async (req, res) => {
  try {
    const { title, slug, short_description, description, thumbnail, preview_video, price, discount_price, level, language, requirements, outcomes } = req.body;
    
    // Check if course belongs to instructor
    const course = await queryOne(
      "SELECT id, status FROM courses WHERE id = ? AND instructor_id = ?",
      [req.params.id, req.user.id]
    );
    if (!course) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'الكورس غير موجود أو مش ملكك' } });
    }

    // Instructor cannot change status - only admin can
    const fields = [];
    const params = [];

    if (title !== undefined) { fields.push("title = ?"); params.push(title); }
    if (slug !== undefined) { fields.push("slug = ?"); params.push(slug); }
    if (short_description !== undefined) { fields.push("short_description = ?"); params.push(short_description); }
    if (description !== undefined) { fields.push("description = ?"); params.push(description); }
    if (thumbnail !== undefined) { fields.push("thumbnail = ?"); params.push(thumbnail); }
    if (preview_video !== undefined) { fields.push("preview_video = ?"); params.push(preview_video); }
    if (price !== undefined) { fields.push("price = ?"); params.push(price); }
    if (discount_price !== undefined) { fields.push("discount_price = ?"); params.push(discount_price); }
    if (level !== undefined) { fields.push("level = ?"); params.push(level); }
    if (language !== undefined) { fields.push("language = ?"); params.push(language); }
    if (requirements !== undefined) { fields.push("requirements = ?"); params.push(JSON.stringify(requirements)); }
    if (outcomes !== undefined) { fields.push("outcomes = ?"); params.push(JSON.stringify(outcomes)); }

    if (!fields.length) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'مفيش حاجة للتعديل' } });
    }

    fields.push("updated_at = NOW()");
    params.push(req.params.id);

    await execute(`UPDATE courses SET ${fields.join(", ")} WHERE id = ?`, params);

    const updatedCourse = await queryOne("SELECT * FROM courses WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: updatedCourse });
  } catch (err) {
    console.error('updateInstructorCourse error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// DELETE /api/instructor/courses/:id
exports.deleteInstructorCourse = async (req, res) => {
  try {
    // Check if course belongs to instructor
    const course = await queryOne(
      "SELECT id FROM courses WHERE id = ? AND instructor_id = ?",
      [req.params.id, req.user.id]
    );
    if (!course) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'الكورس غير موجود أو مش ملكك' } });
    }

    await execute("DELETE FROM courses WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: { message: 'تم حذف الكورس' } });
  } catch (err) {
    console.error('deleteInstructorCourse error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};
