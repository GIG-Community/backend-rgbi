import express from 'express';
import * as foodSecurityController from '../controllers/foodsecurity.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Public routes for retrieving data
router.get('/', foodSecurityController.getAllFoodSecurityData);
router.get('/id/:id', foodSecurityController.getFoodSecurityById);
router.get('/province/:id', foodSecurityController.getFoodSecurityByProvince);
router.get('/year/:year', foodSecurityController.getFoodSecurityByYear);
router.get('/province/:id/year/:year', foodSecurityController.getFoodSecurityByProvinceAndYear);
router.get('/average/:year', foodSecurityController.getAverageFoodSecurityByYear);
router.get('/trend/:id', foodSecurityController.getFoodSecurityTrend);
router.get('/ranking/:year', foodSecurityController.getFoodSecurityRanking);

// Category-related routes
router.get('/stats/category', foodSecurityController.getFoodSecurityStatsByCategory);
router.get('/category/:kategori', foodSecurityController.getProvincesByCategory);

// Protected routes for CRUD operations
router.post('/', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  foodSecurityController.createFoodSecurityData
);

router.put('/:id', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  foodSecurityController.updateFoodSecurityData
);

router.delete('/:id', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  foodSecurityController.deleteFoodSecurityData
);

// Bulk operations
router.post('/bulk-import',
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  foodSecurityController.bulkImportFoodSecurity
);

router.post('/validate-bulk',
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  foodSecurityController.validateBulkImportData
);

// Update categories for existing data
router.put('/update-categories/all',
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  foodSecurityController.updateFoodSecurityCategories
);


export default router;
