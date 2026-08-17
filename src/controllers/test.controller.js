exports.test = (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'test endpoint OK',
      sampleCourses: [
        { id: 'sample-1', title: 'Sample Course 1', slug: 'sample-course-1' },
        { id: 'sample-2', title: 'Sample Course 2', slug: 'sample-course-2' }
      ]
    }
  });
};
