import express from 'express';
import * as supplyChainController from '../controllers/supplychain.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Public routes for retrieving data
router.get('/', supplyChainController.findAll);
router.get('/id/:id', supplyChainController.findOne);
router.get('/year/:tahun', supplyChainController.findByYear);
router.get('/province/:id', supplyChainController.findByProvince);
router.get('/province/:id/year/:tahun', supplyChainController.findByProvinceAndYear);
router.get('/condition/:kondisi', supplyChainController.findByCondition);
router.get('/stats/:tahun', supplyChainController.getStatsByYear);

// Protected routes for CRUD operations
router.post('/', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  supplyChainController.create
);

router.put('/:id', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  supplyChainController.update
);

router.delete('/:id', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  supplyChainController.deleteSupplyChain
);

router.post('/bulk-import',
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  supplyChainController.bulkImportSupplyChain
);

export default router;
