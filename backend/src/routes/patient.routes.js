const router = require('express').Router();
const ctrl = require('../controllers/patient.controller');
const validate = require('../middleware/validate');
const { authorize } = require('../middleware/auth');
const { idParams } = require('../validators/common');
const v = require('../validators/patient');

const staff = authorize('admin', 'doctor');

router.get('/', staff, validate({ query: v.list }), ctrl.list);
router.post('/', staff, validate({ body: v.create }), ctrl.create);
// patients can open only their own record/history - the controller enforces it
router.get('/:id', validate({ params: idParams }), ctrl.getOne);
router.get('/:id/history', validate({ params: idParams }), ctrl.history);
router.patch('/:id', staff, validate({ params: idParams, body: v.update }), ctrl.update);
router.delete('/:id', authorize('admin'), validate({ params: idParams }), ctrl.remove);

module.exports = router;
