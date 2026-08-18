const express = require('express');
const router = express.Router();
const { queryOne } = require('../config/db');

// GET /api/certificates/verify/:serial
router.get('/verify/:serial', async (req, res) => {
  try {
    const { serial } = req.params;
    
    const cert = await queryOne(
      `SELECT cert.serial, cert.issued_at, u.name AS student_name, c.title AS course_title
       FROM certificates cert
       JOIN users u ON u.id = cert.user_id
       JOIN courses c ON c.id = cert.course_id
       WHERE cert.serial = ? LIMIT 1`,
      [serial]
    );
    
    if (!cert) {
      return res.json({
        success: true,
        data: {
          valid: false,
          message: 'الشهادة دي مش موجودة في سجلاتنا'
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        valid: true,
        certificate: cert
      }
    });
  } catch (err) {
    console.error('certificate verification error', err);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Server error' } });
  }
});

module.exports = router;
