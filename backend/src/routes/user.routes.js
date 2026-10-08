const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const validate = require('../middleware/validate');
const { authorize } = require('../middleware/auth');
const { idParams } = require('../validators/common');
const v = require('../validators/user');

router.use(authorize('admin'));
router.get('/', ctrl.list);
router.post('/', validate({ body: v.create }), ctrl.create);
router.patch('/:id', validate({ params: idParams, body: v.update }), ctrl.update);

module.exports = router;
