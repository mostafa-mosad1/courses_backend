const express = require('express');
const router = express.Router();
const { query } = require('../config/db');

// GET /api/stats
router.get('/', async (req, res) => {
  try {
    const [stats] = await query(
      `SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'STUDENT') AS students,
        (SELECT COUNT(*) FROM users WHERE role = 'INSTRUCTOR') AS instructors,
        (SELECT COUNT(*) FROM courses WHERE status = 'PUBLISHED') AS courses,
        (SELECT COUNT(*) FROM certificates) AS certificates,
        (SELECT COUNT(*) FROM enrollments) AS enrollments`
    );
    
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    console.error('stats error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
});

module.exports = router;
