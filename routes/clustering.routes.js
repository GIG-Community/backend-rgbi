import express from 'express';
import * as clusteringController from '../controllers/clustering.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const clusterRouter = express.Router();

// GET routes
clusterRouter.get('/', clusteringController.getAllClusteringData);
clusterRouter.get('/validate-import', clusteringController.validateBulkImportData);
clusterRouter.get('/stats/year/:year', clusteringController.getClusterStatsByYear);
clusterRouter.get('/outliers/year/:year', clusteringController.getOutliersByYear);
clusterRouter.get('/year/:year', clusteringController.getClusteringByYear);
clusterRouter.get('/cluster/:clusterId', clusteringController.getClusteringByClusterId);
clusterRouter.get('/province/:id', clusteringController.getClusteringByProvince);
clusterRouter.get('/:id', clusteringController.getClusteringById);

// POST routes
clusterRouter.post('/', 
    authenticate,
    authorize(['petugas_lapangan', 'pemerintah']),
    clusteringController.createClusteringData
);
clusterRouter.post('/bulk-import', 
    authenticate,
    authorize(['petugas_lapangan', 'pemerintah']),
    clusteringController.bulkImportClustering
);

// PUT routes
clusterRouter.put('/:id', 
    authenticate,
    authorize(['petugas_lapangan', 'pemerintah']),
    clusteringController.updateClusteringData
);

// DELETE routes
clusterRouter.delete('/:id',
    authenticate,
    authorize(['petugas_lapangan', 'pemerintah']),
    clusteringController.deleteClusteringData
);

export default clusterRouter;
