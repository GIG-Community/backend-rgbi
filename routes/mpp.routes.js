import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import * as mppController from '../controllers/mpp.controller.js';

const router = express.Router();

// GET /api/mpp - Get all MPP records
router.get('/', mppController.getAllMPP);

// GET /api/mpp/source/:provinceId - Get MPP by source province (BEFORE /:id)
router.get('/source/:provinceId', mppController.getMPPBySourceProvince);

// POST /api/mpp/bulk - Bulk create MPP records (BEFORE /:id)
router.post('/bulk', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  mppController.bulkCreateMPP
);

// GET /api/mpp/:id - Get MPP by ID
router.get('/:id', mppController.getMPPById);

// POST /api/mpp - Create new MPP record
router.post('/', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  mppController.createMPP
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

export default router;
