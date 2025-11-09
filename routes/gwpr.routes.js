import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import * as gwprController from '../controllers/gwpr.controller.js';

const router = express.Router();

// GET /api/gwpr - Get all GWPR records
router.get('/', gwprController.getAllGWPR);

// GET /api/gwpr/province/:provinceId - Get GWPR by province (BEFORE /:id)
router.get('/province/:provinceId', gwprController.getGWPRByProvince);

// GET /api/gwpr/kelompok/:kelompok - Get GWPR by kelompok (BEFORE /:id)
router.get('/kelompok/:kelompok', gwprController.getGWPRByKelompok);

// POST /api/gwpr/bulk - Bulk create GWPR records (BEFORE /:id)
router.post('/bulk', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  gwprController.bulkCreateGWPR
);

// GET /api/gwpr/:id - Get GWPR by ID
router.get('/:id', gwprController.getGWPRById);

// POST /api/gwpr - Create new GWPR record
router.post('/', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  gwprController.createGWPR
);

// PUT /api/gwpr/:id - Update GWPR record
router.put('/:id', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  gwprController.updateGWPR
);

// DELETE /api/gwpr/:id - Delete GWPR record
router.delete('/:id', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  gwprController.deleteGWPR
);

export default router;
