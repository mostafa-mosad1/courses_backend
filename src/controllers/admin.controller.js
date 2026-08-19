const { query, queryOne, execute } = require('../config/db');
const { randomUUID } = require('crypto');

// GET /api/admin/stats
exports.getStats = async (req, res) => {
  try {
    const [stats] = await query(
      `SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'STUDENT') AS total_students,
        (SELECT COUNT(*) FROM users WHERE role = 'INSTRUCTOR') AS total_instructors,
        (SELECT COUNT(*) FROM courses WHERE status = 'PUBLISHED') AS total_courses,
        (SELECT COUNT(*) FROM enrollments) AS total_enrollments,
        (SELECT COUNT(*) FROM orders WHERE status = 'PAID') AS total_orders,
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status = 'PAID') AS total_revenue`
    );
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('getStats error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// GET /api/admin/courses
exports.getAdminCourses = async (req, res) => {
  try {
    const { status } = req.query;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const offset = (page - 1) * limit;

    let whereSql = '';
    const params = [];
    // Only filter by status if explicitly provided
    if (status && ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status.toUpperCase())) {
      whereSql = 'WHERE c.status = ?';
      params.push(status.toUpperCase());
    }

    console.log('getAdminCourses query params:', { status, page, limit, offset, whereSql, params });

    const [{ total }] = await query(`SELECT COUNT(*) AS total FROM courses c ${whereSql}`, params);
    console.log('Total courses:', total);

    const courses = await query(
      `SELECT c.id, c.title, c.slug, c.status, c.price, c.discount_price, c.level,
              c.students_count, c.rating_avg, c.reviews_count, c.created_at,
              cat.name AS category_name, u.name AS instructor_name
       FROM courses c
       LEFT JOIN categories cat ON cat.id = c.category_id
       LEFT JOIN users u ON u.id = c.instructor_id
       ${whereSql}
       ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    console.log('Courses returned:', courses.length);

    res.json({ success: true, data: courses, meta: { total: Number(total), page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('getAdminCourses error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// POST /api/admin/courses
exports.createCourse = async (req, res) => {
  try {
    const { title, slug, short_description, description, thumbnail, preview_video, price, discount_price, level, language, status, category_id, instructor_id, requirements, outcomes } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'title مطلوب' } });
    }

    // Generate slug from title if not provided
    const courseSlug = slug || title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '');
    
    // Use current user as instructor if not provided
    const courseInstructorId = instructor_id || req.user.id;

    const id = randomUUID();
    await execute(
      `INSERT INTO courses (id, title, slug, short_description, description, thumbnail, preview_video,
                           price, discount_price, level, language, status, category_id, instructor_id,
                           requirements, outcomes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, title, courseSlug, short_description, description, thumbnail, preview_video,
       price || 0, discount_price || null, level || 'BEGINNER', language || 'ar', status || 'DRAFT', category_id, courseInstructorId,
       requirements ? JSON.stringify(requirements) : null, outcomes ? JSON.stringify(outcomes) : null]
    );

    const course = await queryOne("SELECT * FROM courses WHERE id = ?", [id]);
    res.json({ success: true, data: course });
  } catch (err) {
    console.error('createCourse error', err);
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, error: { code: 'CONFLICT', message: 'Slug مستخدم بالفعل' } });
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// GET /api/admin/courses/:id
exports.getAdminCourse = async (req, res) => {
  try {
    const course = await queryOne("SELECT * FROM courses WHERE id = ?", [req.params.id]);
    if (!course) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'الكورس غير موجود' } });
    }
    res.json({ success: true, data: course });
  } catch (err) {
    console.error('getAdminCourse error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// PATCH /api/admin/courses/:id
exports.updateCourse = async (req, res) => {
  try {
    const { title, slug, short_description, description, thumbnail, preview_video, price, discount_price, level, language, status, category_id, requirements, outcomes } = req.body;
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
    if (status !== undefined) { fields.push("status = ?"); params.push(status); }
    if (category_id !== undefined) { fields.push("category_id = ?"); params.push(category_id); }
    if (requirements !== undefined) { fields.push("requirements = ?"); params.push(JSON.stringify(requirements)); }
    if (outcomes !== undefined) { fields.push("outcomes = ?"); params.push(JSON.stringify(outcomes)); }

    if (!fields.length) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'مفيش حاجة للتعديل' } });
    }

    fields.push("updated_at = NOW()");
    params.push(req.params.id);

    await execute(`UPDATE courses SET ${fields.join(", ")} WHERE id = ?`, params);

    const course = await queryOne("SELECT * FROM courses WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: course });
  } catch (err) {
    console.error('updateCourse error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// DELETE /api/admin/courses/:id
exports.deleteCourse = async (req, res) => {
  try {
    await execute("DELETE FROM courses WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: { message: 'تم حذف الكورس' } });
  } catch (err) {
    console.error('deleteCourse error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// PATCH /api/admin/courses/:id/status
exports.updateCourseStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status)) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'status غير صحيح' } });
    }

    await execute("UPDATE courses SET status = ?, updated_at = NOW() WHERE id = ?", [status, req.params.id]);
    const course = await queryOne("SELECT * FROM courses WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: course });
  } catch (err) {
    console.error('updateCourseStatus error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// GET /api/admin/users
exports.getUsers = async (req, res) => {
  try {
    const { role } = req.query;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const offset = (page - 1) * limit;

    let whereSql = '';
    const params = [];
    if (role && ['STUDENT', 'INSTRUCTOR', 'ADMIN'].includes(role.toUpperCase())) {
      whereSql = 'WHERE role = ?';
      params.push(role.toUpperCase());
    }

    const [{ total }] = await query(`SELECT COUNT(*) AS total FROM users ${whereSql}`, params);
    const users = await query(
      `SELECT id, name, email, role, is_active, created_at FROM users ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ success: true, data: users, meta: { total: Number(total), page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('getUsers error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// POST /api/admin/users
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const bcrypt = require('bcryptjs');

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'name, email, and password مطلوبة' } });
    }

    const existing = await queryOne("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (existing) {
      return res.status(400).json({ success: false, error: { code: 'CONFLICT', message: 'الإيميل مستخدم بالفعل' } });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = randomUUID();
    await execute(
      "INSERT INTO users (id, name, email, password, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())",
      [id, name, email, passwordHash, role || 'STUDENT']
    );

    const user = await queryOne("SELECT id, name, email, role, is_active FROM users WHERE id = ?", [id]);
    res.json({ success: true, data: user });
  } catch (err) {
    console.error('createUser error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// DELETE /api/admin/users/:id
exports.deleteUser = async (req, res) => {
  try {
    await execute("DELETE FROM users WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: { message: 'تم حذف المستخدم' } });
  } catch (err) {
    console.error('deleteUser error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// PATCH /api/admin/users/:id/role
exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!role || !['STUDENT', 'INSTRUCTOR', 'ADMIN'].includes(role)) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'role غير صحيح' } });
    }

    await execute("UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?", [role, req.params.id]);
    const user = await queryOne("SELECT id, name, email, role FROM users WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: user });
  } catch (err) {
    console.error('updateUserRole error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// PATCH /api/admin/users/:id/status
exports.updateUserStatus = async (req, res) => {
  try {
    const { is_active } = req.body;
    if (is_active === undefined) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'is_active مطلوب' } });
    }

    await execute("UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ?", [is_active ? 1 : 0, req.params.id]);
    const user = await queryOne("SELECT id, name, email, role, is_active FROM users WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: user });
  } catch (err) {
    console.error('updateUserStatus error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// GET /api/admin/categories
exports.getCategories = async (req, res) => {
  try {
    const categories = await query("SELECT * FROM categories ORDER BY sort_order ASC");
    res.json({ success: true, data: categories });
  } catch (err) {
    console.error('getCategories error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// POST /api/admin/categories
exports.createCategory = async (req, res) => {
  try {
    const { name, slug, description, image, icon, parent_id, sort_order } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'name and slug مطلوبة' } });
    }

    const id = randomUUID();
    await execute(
      "INSERT INTO categories (id, name, slug, description, image, icon, parent_id, sort_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())",
      [id, name, slug, description, image, icon, parent_id, sort_order || 0]
    );

    const category = await queryOne("SELECT * FROM categories WHERE id = ?", [id]);
    res.json({ success: true, data: category });
  } catch (err) {
    console.error('createCategory error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// PATCH /api/admin/categories/:id
exports.updateCategory = async (req, res) => {
  try {
    const { name, slug, description, image, icon, parent_id, sort_order, is_active } = req.body;
    const fields = [];
    const params = [];

    if (name !== undefined) { fields.push("name = ?"); params.push(name); }
    if (slug !== undefined) { fields.push("slug = ?"); params.push(slug); }
    if (description !== undefined) { fields.push("description = ?"); params.push(description); }
    if (image !== undefined) { fields.push("image = ?"); params.push(image); }
    if (icon !== undefined) { fields.push("icon = ?"); params.push(icon); }
    if (parent_id !== undefined) { fields.push("parent_id = ?"); params.push(parent_id); }
    if (sort_order !== undefined) { fields.push("sort_order = ?"); params.push(sort_order); }
    if (is_active !== undefined) { fields.push("is_active = ?"); params.push(is_active ? 1 : 0); }

    if (!fields.length) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'مفيش حاجة للتعديل' } });
    }

    fields.push("updated_at = NOW()");
    params.push(req.params.id);

    await execute(`UPDATE categories SET ${fields.join(", ")} WHERE id = ?`, params);

    const category = await queryOne("SELECT * FROM categories WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: category });
  } catch (err) {
    console.error('updateCategory error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// DELETE /api/admin/categories/:id
exports.deleteCategory = async (req, res) => {
  try {
    await execute("DELETE FROM categories WHERE id = ?", [req.params.id]);
    res.json({ success: true, data: { message: 'تم حذف القسم' } });
  } catch (err) {
    console.error('deleteCategory error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};
