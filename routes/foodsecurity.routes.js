import express from 'express';
import * as foodSecurityController from '../controllers/foodsecurity.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Public routes for retrieving data
router.get('/', foodSecurityController.getAllFoodSecurityData);
router.get('/id/:id', foodSecurityController.getFoodSecurityById);
router.get('/province/:province', foodSecurityController.getFoodSecurityByProvince);
router.get('/year/:year', foodSecurityController.getFoodSecurityByYear);
router.get('/average/:year', foodSecurityController.getAverageFoodSecurityByYear);
router.get('/trend/:province', foodSecurityController.getFoodSecurityTrend);
router.get('/ranking/:year', foodSecurityController.getFoodSecurityRanking);

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

export default router;
