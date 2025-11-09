import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import * as sarController from '../controllers/sar.controller.js';

const router = express.Router();

// GET /api/sar - Get all SAR records
router.get('/', authenticate, sarController.getAllSAR);

// GET /api/sar/:id - Get SAR by ID
router.get('/:id', authenticate, sarController.getSARById);

// POST /api/sar - Create new SAR record
router.post('/', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  sarController.createSAR
);

// POST /api/sar/bulk - Bulk create SAR records
router.post('/bulk', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  sarController.bulkCreateSAR
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

// GET /api/sar/main/:provinceId - Get SAR by main province
router.get('/main/:provinceId', authenticate, sarController.getSARByMainProvince);

export default router;
