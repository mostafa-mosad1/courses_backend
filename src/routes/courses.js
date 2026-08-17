const express = require('express');
const { getCourses, getCourse, getCourseReviews, getRelatedCourses } = require('../controllers/course.controller');
const router = express.Router();

router.get('/', getCourses);
router.get('/:identifier', getCourse);
router.get('/:identifier/reviews', getCourseReviews);
router.get('/:identifier/related', getRelatedCourses);

module.exports = router;
