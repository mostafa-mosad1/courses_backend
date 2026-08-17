const express = require('express');
const { register, login, me, logout, forgotPassword, resetPassword } = require('../controllers/auth.controller');
const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', me);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
