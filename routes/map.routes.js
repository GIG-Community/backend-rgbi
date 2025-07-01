import express from 'express';
import { getMapData, getProvinceMapData } from '../controllers/map.controller.js';

const router = express.Router();

// Simple map data routes
// GET /api/v1/map?year=2020&type=food-security
router.get('/', getMapData);

// Province-specific route
// GET /api/v1/map/province/:id?year=2020&type=all
router.get('/province/:id', getProvinceMapData);

export default router;