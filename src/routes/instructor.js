const express = require('express');
const router = express.Router();
const {
  getInstructorProfile,
  getInstructorCourses,
  createInstructorCourse,
  getInstructorCourse,
  updateInstructorCourse,
  deleteInstructorCourse
} = require('../controllers/instructor.controller');

// Middleware to protect all instructor routes and check for INSTRUCTOR role
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
    const { queryOne } = require('../config/db');
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
    if (user.role !== 'INSTRUCTOR' && user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Instructor access required' } });
    }
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
  }
});

// Profile
router.get('/profile', getInstructorProfile);

// Courses
router.get('/courses', getInstructorCourses);
router.post('/courses', createInstructorCourse);
router.get('/courses/:id', getInstructorCourse);
router.patch('/courses/:id', updateInstructorCourse);
router.delete('/courses/:id', deleteInstructorCourse);

module.exports = router;
