import express from 'express';
import * as connectProvinceController from '../controllers/connectprovince.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Simple test route
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Province connection API is working'
  });
});

// Public routes for retrieving data
// router.get('/provinces', connectProvinceController.getAllProvinces);
// router.get('/province/:id', connectProvinceController.getProvinceById);
// router.get('/province/:id/connections', connectProvinceController.getProvinceConnections);
// router.get('/province/:id/geojson', connectProvinceController.getProvinceGeoJSON);
// router.get('/province/:id/polygon', connectProvinceController.getProvincePolygon);
// router.get('/matrix/:year', connectProvinceController.getTradeMatrix);
// router.get('/statistics', connectProvinceController.getConnectionStatistics);

// Protected routes for CRUD operations
// router.post('/initialize', 
//   authenticate, 
//   authorize(['petugas_lapangan', 'pemerintah']),
//   connectProvinceController.initializeProvinces
// );

router.post('/connection', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  connectProvinceController.createConnection
);

// New route for updating an existing connection
router.put('/connection/:connectionId', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  connectProvinceController.updateConnection
);

router.post('/connections/bulk', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  connectProvinceController.bulkImportConnections
);

// Updated route for deleting connections
router.delete('/connection/:connectionId', 
  authenticate, 
  authorize(['petugas_lapangan', 'pemerintah']), 
  connectProvinceController.deleteConnection
);

export default router;
