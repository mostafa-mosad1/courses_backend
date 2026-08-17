const express = require('express');
const health = require('./health');
const courses = require('./courses');
const auth = require('./auth');
const test = require('./test');
const categories = require('./categories');
const search = require('./search');

const router = express.Router();

// API root - brief index/help
router.get('/', (req, res) => {
	res.json({
		success: true,
		data: {
			message: 'LMS API',
			endpoints: [
				'/api/health',
				'/api/test',
				'/api/courses',
				'/api/categories',
				'/api/search?q=',
				'/api/auth/register'
			]
		}
	});
});

// alias for frontend: GET /api/home
router.get('/home', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'LMS API Home',
      endpoints: [
        '/api/health',
        '/api/test',
        '/api/courses',
        '/api/categories',
        '/api/search?q=',
        '/api/auth/register'
      ]
    }
  });
});

router.use('/health', health);
router.use('/courses', courses);
router.use('/auth', auth);
router.use('/test', test);
router.use('/categories', categories);
router.use('/search', search);

module.exports = router;
