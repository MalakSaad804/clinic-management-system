const router = require('express').Router();
const ctrl = require('../controllers/report.controller');
const validate = require('../middleware/validate');
const { authorize } = require('../middleware/auth');
const v = require('../validators/report');

router.use(authorize('admin', 'doctor'));
router.get('/summary', ctrl.summary);
router.get('/appointments-by-doctor-month', validate({ query: v.perDoctorMonth }), ctrl.appointmentsByDoctorMonth);

module.exports = router;
