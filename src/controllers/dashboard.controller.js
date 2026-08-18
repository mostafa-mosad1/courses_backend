const { query, queryOne, execute, transaction } = require('../config/db');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

// Dashboard controller

// Helper: check if user is enrolled in course
async function getEnrollment(userId, courseId) {
  return queryOne(
    "SELECT * FROM enrollments WHERE user_id = ? AND course_id = ? LIMIT 1",
    [userId, courseId]
  );
}

// Helper: recalculate progress
async function recalcProgress(conn, userId, courseId) {
  const [[{ total }]] = await conn.query(
    `SELECT COUNT(*) AS total FROM lessons l
     JOIN sections s ON s.id = l.section_id WHERE s.course_id = ?`,
    [courseId]
  );
  const [[{ done }]] = await conn.query(
    `SELECT COUNT(*) AS done FROM lesson_progress lp
     JOIN lessons l ON l.id = lp.lesson_id
     JOIN sections s ON s.id = l.section_id
     WHERE s.course_id = ? AND lp.user_id = ? AND lp.is_completed = 1`,
    [courseId, userId]
  );

  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const isDone = progress >= 100;

  await conn.query(
    `UPDATE enrollments
     SET progress = ?, status = ?, completed_at = ?, last_access_at = NOW()
     WHERE user_id = ? AND course_id = ?`,
    [progress, isDone ? "COMPLETED" : "ACTIVE", isDone ? new Date() : null, userId, courseId]
  );

  return { progress, total, done };
}

// GET /api/dashboard/overview
exports.overview = async (req, res) => {
  try {
    const userId = req.user.id;

    const [stats] = await query(
      `SELECT
        (SELECT COUNT(*) FROM enrollments WHERE user_id = ?) AS total_courses,
        (SELECT COUNT(*) FROM enrollments WHERE user_id = ? AND status = 'COMPLETED') AS completed_courses,
        (SELECT COUNT(*) FROM certificates WHERE user_id = ?) AS certificates,
        (SELECT COALESCE(SUM(l.duration), 0) FROM lesson_progress lp
          JOIN lessons l ON l.id = lp.lesson_id
          WHERE lp.user_id = ? AND lp.is_completed = 1) AS learning_seconds`,
      [userId, userId, userId, userId]
    );

    const continueLearning = await query(
      `SELECT c.id, c.title, c.slug, c.thumbnail, e.progress, e.last_access_at
       FROM enrollments e JOIN courses c ON c.id = e.course_id
       WHERE e.user_id = ? AND e.status = 'ACTIVE'
       ORDER BY e.last_access_at DESC, e.enrolled_at DESC LIMIT 3`,
      [userId]
    );

    const notifications = await query(
      `SELECT id, type, title, message, link, is_read, created_at
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`,
      [userId]
    );

    res.json({ success: true, data: { stats, continueLearning, notifications } });
  } catch (err) {
    console.error('overview error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// GET /api/dashboard/courses
exports.myCourses = async (req, res) => {
  try {
    const { status } = req.query;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const offset = (page - 1) * limit;

    const where = ["e.user_id = ?"];
    const params = [req.user.id];
    if (status && ["ACTIVE", "COMPLETED"].includes(status.toUpperCase())) {
      where.push("e.status = ?");
      params.push(status.toUpperCase());
    }
    const whereSql = `WHERE ${where.join(" AND ")}`;

    const [{ total }] = await query(`SELECT COUNT(*) AS total FROM enrollments e ${whereSql}`, params);
    const courses = await query(
      `SELECT c.id, c.title, c.slug, c.thumbnail, c.duration, c.lessons_count,
              e.progress, e.status, e.enrolled_at, e.completed_at, e.last_access_at,
              u.name AS instructor_name
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       LEFT JOIN users u ON u.id = c.instructor_id
       ${whereSql}
       ORDER BY e.last_access_at DESC, e.enrolled_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({ 
      success: true, 
      data: courses, 
      meta: { total: Number(total), page, limit, pages: Math.ceil(total / limit) } 
    });
  } catch (err) {
    console.error('myCourses error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// GET /api/dashboard/courses/:id
exports.courseDetail = async (req, res) => {
  try {
    const courseId = req.params.id;
    const userId = req.user.id;

    const enrollment = await getEnrollment(userId, courseId);
    if (!enrollment) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'إنت مش مشترك في الكورس ده' } });
    }

    const course = await queryOne(
      `SELECT c.id, c.title, c.slug, c.thumbnail, c.description, c.duration,
              c.lessons_count, u.name AS instructor_name, u.image AS instructor_image
       FROM courses c LEFT JOIN users u ON u.id = c.instructor_id
       WHERE c.id = ?`,
      [courseId]
    );
    if (!course) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'الكورس غير موجود' } });
    }

    const sections = await query(
      "SELECT id, title, sort_order FROM sections WHERE course_id = ? ORDER BY sort_order ASC",
      [courseId]
    );
    const lessons = await query(
      `SELECT l.id, l.section_id, l.title, l.type, l.duration, l.sort_order, l.is_free,
              COALESCE(lp.is_completed, 0) AS is_completed,
              COALESCE(lp.watched_seconds, 0) AS watched_seconds
       FROM lessons l
       JOIN sections s ON s.id = l.section_id
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
       WHERE s.course_id = ? ORDER BY l.sort_order ASC`,
      [userId, courseId]
    );

    const curriculum = sections.map(s => ({
      ...s,
      lessons: lessons.filter(l => l.section_id === s.id)
    }));

    const nextLesson = lessons.find(l => !l.is_completed) || lessons[0] || null;

    await execute("UPDATE enrollments SET last_access_at = NOW() WHERE id = ?", [enrollment.id]);

    res.json({ success: true, data: { course, curriculum, enrollment, nextLesson } });
  } catch (err) {
    console.error('courseDetail error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// GET /api/dashboard/profile
exports.getProfile = async (req, res) => {
  try {
    const user = await queryOne(
      `SELECT id, name, email, image, bio, phone, role, locale,
              email_notifications, email_verified_at, created_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    res.json({ success: true, data: user });
  } catch (err) {
    console.error('getProfile error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// PATCH /api/dashboard/profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, bio, phone, image } = req.body;
    const fields = [];
    const params = [];

    if (name !== undefined) { fields.push("name = ?"); params.push(name.trim()); }
    if (bio !== undefined) { fields.push("bio = ?"); params.push(bio); }
    if (phone !== undefined) { fields.push("phone = ?"); params.push(phone); }
    if (image !== undefined) { fields.push("image = ?"); params.push(image); }

    if (!fields.length) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'مفيش حاجة للتعديل' } });
    }

    params.push(req.user.id);
    await execute(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, params);

    const user = await queryOne(
      "SELECT id, name, email, image, bio, phone, role FROM users WHERE id = ?", [req.user.id]
    );
    res.json({ success: true, data: user });
  } catch (err) {
    console.error('updateProfile error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// POST /api/dashboard/enroll/:courseId - enroll in free course
exports.enrollFree = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const userId = req.user.id;

    const course = await queryOne(
      "SELECT id, title, price, status FROM courses WHERE id = ? LIMIT 1",
      [courseId]
    );
    if (!course) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'الكورس غير موجود' } });
    }
    if (course.status !== 'PUBLISHED') {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'الكورس مش منشور' } });
    }
    if (course.price > 0) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'الكورس ده مش مجاني' } });
    }

    const existing = await getEnrollment(userId, courseId);
    if (existing) {
      return res.status(400).json({ success: false, error: { code: 'CONFLICT', message: 'أنت مشترك بالفعل في الكورس ده' } });
    }

    const id = randomUUID();
    await execute(
      "INSERT INTO enrollments (id, user_id, course_id, status, progress, enrolled_at) VALUES (?, ?, ?, 'ACTIVE', 0, NOW())",
      [id, userId, courseId]
    );

    await execute(
      "UPDATE courses SET students_count = students_count + 1 WHERE id = ?",
      [courseId]
    );

    const enrollment = await queryOne("SELECT * FROM enrollments WHERE id = ?", [id]);
    res.json({ success: true, data: enrollment });
  } catch (err) {
    console.error('enrollFree error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// GET /api/dashboard/courses/:courseId/lessons/:lessonId
exports.lessonDetail = async (req, res) => {
  // Lesson detail endpoint
  try {
    const courseId = req.params.courseId;
    const lessonId = req.params.lessonId;
    const userId = req.user.id;

    const enrollment = await getEnrollment(userId, courseId);
    if (!enrollment) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'إنت مش مشترك في الكورس ده' } });
    }

    const lesson = await queryOne(
      `SELECT l.*, s.title AS section_title, s.sort_order AS section_sort_order
       FROM lessons l
       JOIN sections s ON s.id = l.section_id
       WHERE l.id = ? AND s.course_id = ? LIMIT 1`,
      [lessonId, courseId]
    );
    if (!lesson) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'الدرس غير موجود' } });
    }

    // Get lesson progress
    const progress = await queryOne(
      "SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ? LIMIT 1",
      [userId, lessonId]
    );

    // Get attachments
    const attachments = await query(
      "SELECT * FROM attachments WHERE lesson_id = ? ORDER BY created_at ASC",
      [lessonId]
    );

    // Get next/previous lessons
    const allLessons = await query(
      `SELECT l.id, l.title, l.section_id
       FROM lessons l JOIN sections s ON s.id = l.section_id
       WHERE s.course_id = ? ORDER BY s.sort_order ASC, l.sort_order ASC`,
      [courseId]
    );
    const currentIndex = allLessons.findIndex(l => l.id === lessonId);
    const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
    const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

    res.json({
      success: true,
      data: {
        lesson,
        progress,
        attachments,
        prevLesson,
        nextLesson
      }
    });
  } catch (err) {
    console.error('lessonDetail error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// POST /api/dashboard/courses/:courseId/lessons/:lessonId/complete
exports.completeLesson = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const lessonId = req.params.lessonId;
    const userId = req.user.id;

    const enrollment = await getEnrollment(userId, courseId);
    if (!enrollment) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'إنت مش مشترك في الكورس ده' } });
    }

    const lesson = await queryOne(
      `SELECT l.id FROM lessons l JOIN sections s ON s.id = l.section_id
       WHERE l.id = ? AND s.course_id = ? LIMIT 1`,
      [lessonId, courseId]
    );
    if (!lesson) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'الدرس غير موجود' } });
    }

    const existing = await queryOne(
      "SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ? LIMIT 1",
      [userId, lessonId]
    );

    if (existing) {
      await execute(
        "UPDATE lesson_progress SET is_completed = 1, completed_at = NOW(), updated_at = NOW() WHERE id = ?",
        [existing.id]
      );
    } else {
      const id = randomUUID();
      await execute(
        "INSERT INTO lesson_progress (id, user_id, lesson_id, is_completed, completed_at) VALUES (?, ?, ?, 1, NOW())",
        [id, userId, lessonId]
      );
    }

    // Recalculate course progress
    const totalLessons = await query(
      `SELECT COUNT(*) AS total FROM lessons l
       JOIN sections s ON s.id = l.section_id WHERE s.course_id = ?`,
      [courseId]
    );
    const completedLessons = await query(
      `SELECT COUNT(*) AS done FROM lesson_progress lp
       JOIN lessons l ON l.id = lp.lesson_id
       JOIN sections s ON s.id = l.section_id
       WHERE s.course_id = ? AND lp.user_id = ? AND lp.is_completed = 1`,
      [courseId, userId]
    );

    const total = totalLessons[0]?.total || 0;
    const done = completedLessons[0]?.done || 0;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    const isDone = progress >= 100;

    await execute(
      `UPDATE enrollments
       SET progress = ?, status = ?, completed_at = ?, last_access_at = NOW()
       WHERE user_id = ? AND course_id = ?`,
      [progress, isDone ? "COMPLETED" : "ACTIVE", isDone ? new Date() : null, userId, courseId]
    );

    res.json({ success: true, data: { progress } });
  } catch (err) {
    console.error('completeLesson error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// GET /api/dashboard/wishlist
exports.getWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const wishlist = await query(
      `SELECT w.id, w.created_at, c.id AS course_id, c.title, c.slug, c.thumbnail,
              c.short_description, c.price, c.discount_price, c.rating_avg, c.students_count,
              u.name AS instructor_name
       FROM wishlist w
       JOIN courses c ON c.id = w.course_id
       LEFT JOIN users u ON u.id = c.instructor_id
       WHERE w.user_id = ?
       ORDER BY w.created_at DESC`,
      [userId]
    );
    res.json({ success: true, data: wishlist });
  } catch (err) {
    console.error('getWishlist error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// POST /api/dashboard/wishlist
exports.addToWishlist = async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user.id;

    if (!courseId) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'courseId مطلوب' } });
    }

    const course = await queryOne("SELECT id FROM courses WHERE id = ? LIMIT 1", [courseId]);
    if (!course) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'الكورس غير موجود' } });
    }

    const existing = await queryOne(
      "SELECT * FROM wishlist WHERE user_id = ? AND course_id = ? LIMIT 1",
      [userId, courseId]
    );
    if (existing) {
      return res.status(400).json({ success: false, error: { code: 'CONFLICT', message: 'الكورس موجود بالفعل في المفضلة' } });
    }

    const id = randomUUID();
    await execute(
      "INSERT INTO wishlist (id, user_id, course_id, created_at) VALUES (?, ?, ?, NOW())",
      [id, userId, courseId]
    );

    res.json({ success: true, data: { id, courseId } });
  } catch (err) {
    console.error('addToWishlist error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// DELETE /api/dashboard/wishlist/:courseId
exports.removeFromWishlist = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const userId = req.user.id;

    if (!courseId) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'courseId مطلوب' } });
    }

    const existing = await queryOne(
      "SELECT * FROM wishlist WHERE user_id = ? AND course_id = ? LIMIT 1",
      [userId, courseId]
    );
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'الكورس مش موجود في المفضلة' } });
    }

    await execute("DELETE FROM wishlist WHERE user_id = ? AND course_id = ?", [userId, courseId]);

    res.json({ success: true, data: { message: 'تم الحذف من المفضلة' } });
  } catch (err) {
    console.error('removeFromWishlist error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};

// POST /api/dashboard/reviews
exports.addReview = async (req, res) => {
  try {
    const { courseId, rating, comment } = req.body;
    const userId = req.user.id;

    if (!courseId || !rating) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'courseId و rating مطلوبين' } });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'rating لازم يكون بين 1 و 5' } });
    }

    // Check if user is enrolled in the course
    const enrollment = await getEnrollment(userId, courseId);
    if (!enrollment) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'لازم تكون مشترك في الكورس عشان تكتب review' } });
    }

    // Check if course exists
    const course = await queryOne("SELECT id FROM courses WHERE id = ? LIMIT 1", [courseId]);
    if (!course) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'الكورس غير موجود' } });
    }

    // Check if user already reviewed
    const existing = await queryOne(
      "SELECT * FROM reviews WHERE user_id = ? AND course_id = ? LIMIT 1",
      [userId, courseId]
    );
    if (existing) {
      return res.status(400).json({ success: false, error: { code: 'CONFLICT', message: 'أنت كتبت review بالفعل للكورس ده' } });
    }

    const id = randomUUID();
    await execute(
      "INSERT INTO reviews (id, user_id, course_id, rating, comment, is_approved, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())",
      [id, userId, courseId, rating, comment || null]
    );

    // Update course rating
    const [{ avg, count }] = await query(
      `SELECT AVG(rating) AS avg, COUNT(*) AS count FROM reviews WHERE course_id = ? AND is_approved = 1`,
      [courseId]
    );
    await execute(
      "UPDATE courses SET rating_avg = ?, reviews_count = ? WHERE id = ?",
      [avg ? parseFloat(avg.toFixed(2)) : 0, count, courseId]
    );

    const review = await queryOne(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.name AS user_name
       FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.id = ?`,
      [id]
    );

    res.json({ success: true, data: review });
  } catch (err) {
    console.error('addReview error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
};
