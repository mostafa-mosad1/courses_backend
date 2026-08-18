const express = require('express');
const router = express.Router();
const { query, queryOne, execute } = require('../config/db');
const { randomUUID } = require('crypto');

// Middleware to protect all enrollment routes
router.use(async (req, res, next) => {
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
  
  function extractToken(req) {
    if (req.cookies && req.cookies.token) return req.cookies.token;
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) return header.slice(7);
    return null;
  }
  
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await queryOne(
      'SELECT id, name, email, image, role, is_active FROM users WHERE id = ? LIMIT 1',
      [decoded.id]
    );
    if (!user) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    if (!user.is_active) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Account suspended' } });
    }
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
  }
});

// POST /api/enrollments - enroll in a course
router.post('/', async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user.id;

    if (!courseId) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'courseId required' } });
    }

    const course = await queryOne("SELECT id, title, price, discount_price FROM courses WHERE id = ? LIMIT 1", [courseId]);
    if (!course) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'الكورس غير موجود' } });
    }

    const existing = await queryOne(
      "SELECT * FROM enrollments WHERE user_id = ? AND course_id = ? LIMIT 1",
      [userId, courseId]
    );
    if (existing) {
      return res.status(400).json({ success: false, error: { code: 'CONFLICT', message: 'أنت مشترك في الكورس ده بالفعل' } });
    }

    const id = randomUUID();
    const price = course.discount_price || course.price;
    
    await execute(
      "INSERT INTO enrollments (id, user_id, course_id, status, progress, enrolled_at) VALUES (?, ?, ?, 'ACTIVE', 0, NOW())",
      [id, userId, courseId]
    );

    const enrollment = await queryOne(
      `SELECT e.*, c.title AS course_title, c.slug AS course_slug, c.thumbnail
       FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.id = ?`,
      [id]
    );

    res.json({ success: true, data: enrollment });
  } catch (err) {
    console.error('enroll error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
});

// GET /api/enrollments - get user enrollments
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    let where = "e.user_id = ?";
    const params = [userId];
    if (status) {
      where += " AND e.status = ?";
      params.push(status);
    }

    const enrollments = await query(
      `SELECT e.*, c.title AS course_title, c.slug AS course_slug, c.thumbnail
       FROM enrollments e JOIN courses c ON c.id = e.course_id
       WHERE ${where} ORDER BY e.enrolled_at DESC`,
      params
    );

    res.json({ success: true, data: enrollments });
  } catch (err) {
    console.error('get enrollments error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
});

// GET /api/enrollments/:id - get enrollment details
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user.id;

    const enrollment = await queryOne(
      `SELECT e.*, c.title AS course_title, c.slug AS course_slug, c.thumbnail
       FROM enrollments e JOIN courses c ON c.id = e.course_id
       WHERE e.id = ? AND e.user_id = ? LIMIT 1`,
      [id, userId]
    );

    if (!enrollment) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'الاشتراك غير موجود' } });
    }

    res.json({ success: true, data: enrollment });
  } catch (err) {
    console.error('get enrollment error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
});

// DELETE /api/enrollments/:id - cancel enrollment
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user.id;

    const enrollment = await queryOne(
      "SELECT * FROM enrollments WHERE id = ? AND user_id = ? LIMIT 1",
      [id, userId]
    );
    if (!enrollment) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'الاشتراك غير موجود' } });
    }

    await execute("DELETE FROM enrollments WHERE id = ?", [id]);

    res.json({ success: true, data: { message: 'تم إلغاء الاشتراك' } });
  } catch (err) {
    console.error('cancel enrollment error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
});

module.exports = router;
