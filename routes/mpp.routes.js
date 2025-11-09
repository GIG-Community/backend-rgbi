import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import * as mppController from '../controllers/mpp.controller.js';

const router = express.Router();

// GET /api/mpp - Get all MPP records
router.get('/', authenticate, mppController.getAllMPP);

// GET /api/mpp/:id - Get MPP by ID
router.get('/:id', authenticate, mppController.getMPPById);

// POST /api/mpp - Create new MPP record
router.post('/', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  mppController.createMPP
);

// POST /api/mpp/bulk - Bulk create MPP records
router.post('/bulk', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  mppController.bulkCreateMPP
);

// PUT /api/mpp/:id - Update MPP record
router.put('/:id', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  mppController.updateMPP
);

// DELETE /api/mpp/:id - Delete MPP record
router.delete('/:id', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  mppController.deleteMPP
);

// GET /api/mpp/source/:provinceId - Get MPP by source province
router.get('/source/:provinceId', authenticate, mppController.getMPPBySourceProvince);

export default router;
