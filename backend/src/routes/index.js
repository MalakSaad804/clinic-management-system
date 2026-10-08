const router = require('express').Router();

router.use('/users', require('./user.routes'));
router.use('/patients', require('./patient.routes'));
router.use('/doctors', require('./doctor.routes'));
router.use('/visits', require('./visit.routes'));
router.use('/reports', require('./report.routes'));
router.use('/audit-logs', require('./audit.routes'));

module.exports = router;
