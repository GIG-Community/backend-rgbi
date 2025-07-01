import express from 'express';
import {
  getFoodSecurityMapData,
  getSupplyChainMapData,
  getConnectionsMapData,
  getCombinedMapData,
  getProvincesBaseMap,
  getMapDebugInfo,
  getProvinceMapDetails,
  getProvinceMapSummary,
  getProvinceMapDataById,
  getMultipleProvincesMapData
} from '../controllers/map.controller.js';

const router = express.Router();

// Base map routes
router.get('/provinces', getProvincesBaseMap);
router.get('/debug', getMapDebugInfo);

// Year-based map data routes
router.get('/food-security/:year', getFoodSecurityMapData);
router.get('/supply-chain/:year', getSupplyChainMapData);
router.get('/connections/:year', getConnectionsMapData);
router.get('/combined/:year', getCombinedMapData);

// Province-specific routes
router.get('/province/:id', getProvinceMapDetails);
router.get('/province/:id/summary', getProvinceMapSummary);
router.get('/province/:id/data', getProvinceMapDataById);
router.get('/province/:id/geojson', getProvinceMapDataById); // Alias that auto-includes geojson

// Multiple provinces route
router.get('/provinces/data', getMultipleProvincesMapData);

export default router;

