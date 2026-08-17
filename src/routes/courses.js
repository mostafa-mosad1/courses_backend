const express = require('express');
const { getCourses, getCourse } = require('../controllers/course.controller');
const router = express.Router();

router.get('/', getCourses);
router.get('/:identifier', getCourse);

module.exports = router;
