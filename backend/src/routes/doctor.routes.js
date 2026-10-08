const router = require('express').Router();
const ctrl = require('../controllers/doctor.controller');
const validate = require('../middleware/validate');
const { authorize } = require('../middleware/auth');
const { idParams } = require('../validators/common');
const v = require('../validators/doctor');

router.get('/', validate({ query: v.list }), ctrl.list);
router.get('/:id', validate({ params: idParams }), ctrl.getOne);
router.post('/', authorize('admin'), validate({ body: v.create }), ctrl.create);
router.patch('/:id', authorize('admin'), validate({ params: idParams, body: v.update }), ctrl.update);
router.delete('/:id', authorize('admin'), validate({ params: idParams }), ctrl.remove);

module.exports = router;
