import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import * as sarController from '../controllers/sar.controller.js';

const router = express.Router();

// GET /api/sar - Get all SAR records
router.get('/', sarController.getAllSAR);

// GET /api/sar/main/:provinceId - Get SAR by main province (BEFORE /:id)
router.get('/main/:provinceId', sarController.getSARByMainProvince);

// POST /api/sar/bulk - Bulk create SAR records (BEFORE /:id)
router.post('/bulk', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  sarController.bulkCreateSAR
);

// GET /api/sar/:id - Get SAR by ID
router.get('/:id', sarController.getSARById);

// POST /api/sar - Create new SAR record
router.post('/', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  sarController.createSAR
);

// PUT /api/sar/:id - Update SAR record
router.put('/:id', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  sarController.updateSAR
);

// DELETE /api/sar/:id - Delete SAR record
router.delete('/:id', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  sarController.deleteSAR
);

export default router;
