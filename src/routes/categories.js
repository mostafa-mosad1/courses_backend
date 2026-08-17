const express = require('express');
const { getCategories, getCategory } = require('../controllers/category.controller');
const router = express.Router();

router.get('/', getCategories);
router.get('/:slug', getCategory);

module.exports = router;
