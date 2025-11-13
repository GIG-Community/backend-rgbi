import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import * as climateController from '../controllers/climate.controller.js';

const router = express.Router();

// GET /api/climate - Get all Climate records
router.get('/', climateController.getAllClimate);

// GET /api/climate/:id - Get Climate by ID
router.get('/:id', climateController.getClimateById);

// POST /api/climate - Create new Climate record
router.post('/', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  climateController.createClimate
);

// POST /api/climate/bulk - Bulk create Climate records
router.post('/bulk', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  climateController.bulkCreateClimate
);

// POST /api/climate/stream - Stream bulk create Climate records for very large datasets
router.post('/stream', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  climateController.streamBulkCreateClimate
);

// PUT /api/climate/:id - Update Climate record
router.put('/:id', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  climateController.updateClimate
);

// DELETE /api/climate/:id - Delete Climate record
router.delete('/:id', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  climateController.deleteClimate
);

// GET /api/climate/province/:provinceId - Get Climate by province
router.get('/province/:provinceId', authenticate, climateController.getClimateByProvince);

// GET /api/climate/year/:year - Get Climate by year
router.get('/year/:year', authenticate, climateController.getClimateByYear);

export default router;
