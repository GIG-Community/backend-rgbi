import express from 'express';
import * as mapController from '../controllers/map.controller.js';

const router = express.Router();

// Base map endpoints
router.get('/provinces', mapController.getProvincesBaseMap);
// router.get('/debug', mapController.getMapDebugInfo);

// Province detail endpoints for map interaction
router.get('/province/:id/details', mapController.getProvinceMapDetails);
router.get('/province/:id/summary', mapController.getProvinceMapSummary);

// Data visualization endpoints
router.get('/food-security/:year', mapController.getFoodSecurityMapData);
router.get('/supply-chain/:year', mapController.getSupplyChainMapData);
router.get('/connections/:year', mapController.getConnectionsMapData);
router.get('/combined/:year', mapController.getCombinedMapData);

export default router;

