const express = require('express');
const health = require('./health');
const courses = require('./courses');
const auth = require('./auth');
const test = require('./test');
const categories = require('./categories');

const router = express.Router();

router.use('/health', health);
router.use('/courses', courses);
router.use('/auth', auth);
router.use('/test', test);
router.use('/categories', categories);

module.exports = router;
