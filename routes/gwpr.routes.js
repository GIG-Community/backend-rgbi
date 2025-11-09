import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import * as gwprController from '../controllers/gwpr.controller.js';

const router = express.Router();

// GET /api/gwpr - Get all GWPR records
router.get('/', authenticate, gwprController.getAllGWPR);

// GET /api/gwpr/:id - Get GWPR by ID
router.get('/:id', authenticate, gwprController.getGWPRById);

// POST /api/gwpr - Create new GWPR record
router.post('/', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  gwprController.createGWPR
);

// POST /api/gwpr/bulk - Bulk create GWPR records
router.post('/bulk', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  gwprController.bulkCreateGWPR
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

// GET /api/gwpr/province/:provinceId - Get GWPR by province
router.get('/province/:provinceId', authenticate, gwprController.getGWPRByProvince);
// GET /api/gwpr/kelompok/:kelompok - Get GWPR by kelompok
router.get('/kelompok/:kelompok', authenticate, gwprController.getGWPRByKelompok);

export default router;
