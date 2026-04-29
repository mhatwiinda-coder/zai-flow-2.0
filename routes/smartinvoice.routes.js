const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/smartinvoice.controller');
const auth    = require('../middleware/auth');
const role    = require('../middleware/role');

// All ZRA routes require authentication
router.use(auth);

router.get('/status',                          ctrl.getStatus);
router.post('/configure',  role(['admin','supervisor']), ctrl.configure);
router.get('/invoices/:saleId',                ctrl.getFiscalBySale);
router.get('/queue',       role(['admin','supervisor']), ctrl.getQueue);
router.post('/sync',       role(['admin','supervisor']), ctrl.syncQueue);
router.post('/resubmit/:saleId', role(['admin','supervisor']), ctrl.resubmit);

module.exports = router;
