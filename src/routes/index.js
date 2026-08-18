const express = require('express');
const health = require('./health');
const courses = require('./courses');
const auth = require('./auth');
const test = require('./test');
const categories = require('./categories');
const search = require('./search');
const stats = require('./stats');
const certificates = require('./certificates');
const dashboard = require('./dashboard');
const { home } = require('../controllers/public.controller');

const router = express.Router();

// API root - brief index/help
router.get('/', (req, res) => {
	res.json({
		success: true,
		data: {
			message: 'LMS API',
			endpoints: [
				'/api/health',
				'/api/home',
				'/api/test',
				'/api/courses',
				'/api/categories',
				'/api/search?q=',
				'/api/auth/register',
				'/api/stats',
				'/api/certificates/verify/:serial',
				'/api/dashboard/overview',
				'/api/dashboard/courses'
			]
		}
	});
});

// GET /api/home
router.get('/home', home);

router.use('/health', health);
router.use('/courses', courses);
router.use('/auth', auth);
router.use('/test', test);
router.use('/categories', categories);
router.use('/search', search);
router.use('/stats', stats);
router.use('/certificates', certificates);
router.use('/dashboard', dashboard);

module.exports = router;
