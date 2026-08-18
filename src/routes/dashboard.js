const express = require('express');
const router = express.Router();
const {
  overview,
  myCourses,
  courseDetail,
  getProfile,
  updateProfile,
  enrollFree,
  lessonDetail,
  completeLesson,
  updateLessonProgress,
  getLessonProgress,
  myCertificates,
  requestCertificate,
  getSettings,
  updateSettings,
  changePassword,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  addReview
} = require('../controllers/dashboard.controller');

// Middleware to protect all dashboard routes
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
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
  }
});

// GET /api/dashboard/overview
router.get('/overview', overview);

// GET /api/dashboard/courses
router.get('/courses', myCourses);
router.get('/courses/:id', courseDetail);
router.get('/courses/:courseId/lessons/:lessonId', lessonDetail);
router.post('/courses/:courseId/lessons/:lessonId/complete', completeLesson);
router.get('/courses/:courseId/lessons/:lessonId/progress', getLessonProgress);
router.patch('/courses/:courseId/lessons/:lessonId/progress', updateLessonProgress);

// POST /api/dashboard/enroll/:courseId - enroll in free course
router.post('/enroll/:courseId', enrollFree);

// GET /api/dashboard/certificates
router.get('/certificates', myCertificates);
router.post('/certificates', requestCertificate);

// GET /api/dashboard/profile
router.get('/profile', getProfile);
router.patch('/profile', updateProfile);
router.get('/wishlist', getWishlist);
router.post('/wishlist', addToWishlist);
router.delete('/wishlist/:courseId', removeFromWishlist);

// Reviews routes
router.post('/reviews', addReview);

// GET /api/dashboard/settings
router.get('/settings', getSettings);
router.patch('/settings', updateSettings);
router.patch('/settings/password', changePassword);

module.exports = router;
