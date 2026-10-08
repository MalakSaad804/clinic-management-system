const router = require('express').Router();
const ctrl = require('../controllers/visit.controller');
const validate = require('../middleware/validate');
const { authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { z, objectId, idParams } = require('../validators/common');
const v = require('../validators/visit');

const staff = authorize('admin', 'doctor');
const fileParams = z.object({ id: objectId, filename: z.string().regex(/^[\w-]+\.(jpg|png|webp)$/) });

router.get('/', validate({ query: v.list }), ctrl.list);
router.get('/slots', staff, validate({ query: v.slots }), ctrl.slots); // must be before "/:id"
router.post('/', staff, validate({ body: v.create }), ctrl.create);
router.get('/:id', validate({ params: idParams }), ctrl.getOne);
router.patch('/:id', staff, validate({ params: idParams, body: v.update }), ctrl.update);
router.delete('/:id', authorize('admin'), validate({ params: idParams }), ctrl.remove);

// Role check first, THEN multer - unauthorised users can never write a file to disk.
router.post('/:id/prescriptions', staff, validate({ params: idParams }), upload.single('prescription'), ctrl.uploadPrescription);
router.get('/:id/prescriptions/:filename', validate({ params: fileParams }), ctrl.getPrescription);
router.delete('/:id/prescriptions/:filename', staff, validate({ params: fileParams }), ctrl.deletePrescription);

module.exports = router;
