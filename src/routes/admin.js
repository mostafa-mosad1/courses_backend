const express = require('express');
const router = express.Router();
const {
  getStats,
  getAdminCourses,
  createCourse,
  getAdminCourse,
  updateCourse,
  deleteCourse,
  updateCourseStatus,
  getUsers,
  createUser,
  deleteUser,
  updateUserRole,
  updateUserStatus,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/admin.controller');

// Middleware to protect all admin routes and check for ADMIN role
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
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    }
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
  }
});

// Stats
router.get('/stats', getStats);

// Courses
router.get('/courses', getAdminCourses);
router.post('/courses', createCourse);
router.get('/courses/:id', getAdminCourse);
router.patch('/courses/:id', updateCourse);
router.delete('/courses/:id', deleteCourse);
router.patch('/courses/:id/status', updateCourseStatus);

// Users
router.get('/users', getUsers);
router.post('/users', createUser);
router.delete('/users/:id', deleteUser);
router.patch('/users/:id/role', updateUserRole);
router.patch('/users/:id/status', updateUserStatus);

// Categories
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.patch('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

module.exports = router;
