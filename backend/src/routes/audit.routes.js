const router = require('express').Router();
const ctrl = require('../controllers/audit.controller');
const validate = require('../middleware/validate');
const { authorize } = require('../middleware/auth');
const v = require('../validators/report');

router.get('/', authorize('admin'), validate({ query: v.auditList }), ctrl.list);

module.exports = router;
