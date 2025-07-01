import mongoose from 'mongoose';
import Province from '../models/province.model.js';
import FoodSecurity from '../models/foodsecurity.model.js';
import SupplyChain from '../models/supplychain.model.js';
import ProvinceConnection from '../models/provinceConnection.model.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Get map data with flexible type and year filtering
 * Query params: year, type (base, food-security, supply-chain, connections, combined)
 */
export const getMapData = asyncHandler(async (req, res) => {
  const { year, type = 'base' } = req.query;
  
  // If no specific type requested or type is 'base', return base map
  if (type === 'base') {
    return getProvincesBaseMap(req, res);
  }
  
  // For other types, we need a year
  if (!year) {
    return res.status(400).json({
      success: false,
      message: 'Year parameter is required for this data type'
    });
  }
  
  // Validate year
  const yearInt = parseInt(year, 10);
  if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
    return res.status(400).json({
      success: false,
      message: 'Invalid year. Year must be between 2000 and 2100'
    });
  }
  
  // Route request to appropriate handler based on type
  const modifiedReq = { ...req, params: { ...req.params, year: yearInt.toString() } };
  
  switch (type) {
    case 'food-security':
      return getFoodSecurityMapData(modifiedReq, res);
    case 'supply-chain':
      return getSupplyChainMapData(modifiedReq, res);
    case 'connections':
      return getConnectionsMapData(modifiedReq, res);
    case 'combined':
      return getCombinedMapData(modifiedReq, res);
    default:
      return res.status(400).json({
        success: false,
        message: 'Invalid data type. Supported types: base, food-security, supply-chain, connections, combined'
      });
  }
});

/**
 * Get province-specific map data
 * Path params: id (province ID)
 * Query params: year, type (geojson, food-security, supply-chain, connections, all)
 */
export const getProvinceMapData = asyncHandler(async (req, res) => {
  const { id: provinceId } = req.params;
  const { year, type = 'geojson' } = req.query;
  
  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(provinceId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid province ID format'
    });
  }
  
  // Get province info
  const province = await Province.findById(provinceId);
  if (!province) {
    return res.status(404).json({
      success: false,
      message: 'Province not found'
    });
  }
  
  // Prepare response object
  const response = {
    provinceId: province._id,
    provinceName: province.name,
    provinceCode: province.code,
    data: {}
  };
  
  // Parse year if provided
  let yearInt = null;
  if (year) {
    yearInt = parseInt(year, 10);
    if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid year. Year must be between 2000 and 2100'
      });
    }
    response.requestedYear = yearInt;
  }
  
  // Always add GeoJSON data, regardless of type
  if (!province.geoData) {
    response.data.geojson = null;
    response.warnings = response.warnings || [];
    response.warnings.push('Province has no geographic data');
  } else {
    response.data.geojson = {
      type: "Feature",
      properties: {
        provinceId: province._id,
        provinceName: province.name,
        provinceCode: province.code
      },
      geometry: province.geoData.geometry
    };
  }
  
  // If type is just geojson or no year provided, return the response now
  if (type === 'geojson' || !yearInt) {
    return res.status(200).json({
      success: true,
      data: response
    });
  }
  
  // Get additional data based on type
  try {
    if (type === 'food-security' || type === 'all') {
      const fsData = await FoodSecurity.findOne({ 
        provinsi: province.name, 
        tahun: yearInt 
      });
      
      if (fsData) {
        response.data.foodSecurity = {
          year: fsData.tahun,
          index: fsData.dependent_variable.indeks_ketahanan_pangan,
          category: fsData.kategori_ketahanan_pangan
        };
        
        // Add to GeoJSON properties if it exists
        if (response.data.geojson) {
          response.data.geojson.properties.foodSecurity = response.data.foodSecurity;
        }
      }
    }
    
    if (type === 'supply-chain' || type === 'all') {
      const scData = await SupplyChain.findOne({ 
        provinsi: province.name, 
        tahun: yearInt 
      });
      
      if (scData) {
        const production = scData.produksiBeras || 0;
        const consumption = scData.konsumsiBeras || 0;
        
        response.data.supplyChain = {
          year: scData.tahun,
          production: production,
          consumption: consumption,
          balance: production - consumption,
          balanceType: production > consumption ? 'surplus' : production < consumption ? 'deficit' : 'balanced'
        };
        
        // Add to GeoJSON properties if it exists
        if (response.data.geojson) {
          response.data.geojson.properties.supplyChain = response.data.supplyChain;
        }
      }
    }
    
    if (type === 'connections' || type === 'all') {
      const [outgoing, incoming] = await Promise.all([
        ProvinceConnection.countDocuments({
          sourceProvinceId: provinceId,
          year: yearInt
        }),
        
        ProvinceConnection.countDocuments({
          targetProvinceId: provinceId,
          year: yearInt
        })
      ]);
      
      response.data.connections = {
        outgoing: outgoing,
        incoming: incoming,
        total: outgoing + incoming
      };
      
      // Add to GeoJSON properties if it exists
      if (response.data.geojson) {
        response.data.geojson.properties.connections = response.data.connections;
      }
    }
    
    return res.status(200).json({
      success: true,
      data: response
    });
    
  } catch (error) {
    console.error('Error getting province data:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting province data',
      error: error.message
    });
  }
});

/**
 * Get all provinces with basic geoData (for base map)
 */
export const getProvincesBaseMap = asyncHandler(async (req, res) => {
  try {
    const provinces = await Province.find(
      { geoData: { $exists: true, $ne: null } },
      'name code geoData'
    );
    
    const features = provinces.map(province => ({
      type: "Feature",
      properties: {
        provinceId: province._id,
        provinceName: province.name,
        provinceCode: province.code
      },
      geometry: province.geoData.geometry
    }));
    
    const geoJsonResponse = {
      type: "FeatureCollection",
      features: features,
      metadata: {
        totalProvinces: features.length,
        dataType: 'base_map'
      }
    };
    
    return res.status(200).json({
      success: true,
      data: geoJsonResponse
    });
    
  } catch (error) {
    console.error('Error getting provinces base map:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting provinces base map',
      error: error.message
    });
  }
});

/**
 * Get map data for food security visualization
 */
export const getFoodSecurityMapData = asyncHandler(async (req, res) => {
  const { year } = req.params;
  const { category } = req.query;
  
  // Validate year
  const yearInt = parseInt(year, 10);
  if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
    return res.status(400).json({
      success: false,
      message: 'Invalid year. Year must be between 2000 and 2100'
    });
  }
  
  try {
    // Build query for food security data
    let foodSecurityQuery = { tahun: yearInt };
    if (category) {
      foodSecurityQuery['kategori_ketahanan_pangan.kategori'] = parseInt(category);
    }
    
    // Get food security data for the year
    const foodSecurityData = await FoodSecurity.find(foodSecurityQuery);
    
    if (foodSecurityData.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No food security data found for year ${yearInt}`,
        year: yearInt
      });
    }
    
    // Get all provinces with geoData
    const provinces = await Province.find(
      { geoData: { $exists: true, $ne: null } },
      'name code geoData'
    );
    
    // Create a map of province names to food security data
    const foodSecurityMap = {};
    foodSecurityData.forEach(item => {
      foodSecurityMap[item.provinsi] = item;
    });
    
    // Build GeoJSON FeatureCollection
    const features = provinces
      .filter(province => foodSecurityMap[province.name])
      .map(province => {
        const fsData = foodSecurityMap[province.name];
        return {
          type: "Feature",
          properties: {
            provinceId: province._id,
            provinceName: province.name,
            provinceCode: province.code,
            year: yearInt,
            foodSecurityIndex: fsData.dependent_variable.indeks_ketahanan_pangan,
            category: fsData.kategori_ketahanan_pangan
          },
          geometry: province.geoData.geometry
        };
      });
    
    const geoJsonResponse = {
      type: "FeatureCollection",
      features: features,
      metadata: {
        year: yearInt,
        totalProvinces: features.length,
        dataType: 'food_security'
      }
    };
    
    return res.status(200).json({
      success: true,
      data: geoJsonResponse
    });
    
  } catch (error) {
    console.error('Error getting food security map data:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting food security map data',
      error: error.message
    });
  }
});

/**
 * Get map data for supply chain visualization
 */
export const getSupplyChainMapData = asyncHandler(async (req, res) => {
  const { year } = req.params;
  const { condition } = req.query; // surplus, deficit, balanced
  
  // Validate year
  const yearInt = parseInt(year, 10);
  if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
    return res.status(400).json({
      success: false,
      message: 'Invalid year. Year must be between 2000 and 2100'
    });
  }
  
  try {
    // Build query for supply chain data
    let supplyChainQuery = { tahun: yearInt };
    
    // Add condition filter if specified
    if (condition) {
      if (condition === 'surplus') {
        supplyChainQuery = { ...supplyChainQuery, $expr: { $gt: ["$produksiBeras", "$konsumsiBeras"] } };
      } else if (condition === 'deficit') {
        supplyChainQuery = { ...supplyChainQuery, $expr: { $lt: ["$produksiBeras", "$konsumsiBeras"] } };
      } else if (condition === 'balanced') {
        supplyChainQuery = { ...supplyChainQuery, $expr: { $eq: ["$produksiBeras", "$konsumsiBeras"] } };
      }
    }
    
    // Get supply chain data for the year
    const supplyChainData = await SupplyChain.find(supplyChainQuery);
    
    if (supplyChainData.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No supply chain data found for year ${yearInt}`,
        year: yearInt
      });
    }
    
    // Get all provinces with geoData
    const provinces = await Province.find(
      { geoData: { $exists: true, $ne: null } },
      'name code geoData'
    );
    
    // Create a map of province names to supply chain data
    const supplyChainMap = {};
    supplyChainData.forEach(item => {
      supplyChainMap[item.provinsi] = item;
    });
    
    // Build GeoJSON FeatureCollection
    const features = provinces
      .filter(province => supplyChainMap[province.name])
      .map(province => {
        const scData = supplyChainMap[province.name];
        const production = scData.produksiBeras || 0;
        const consumption = scData.konsumsiBeras || 0;
        const balance = production - consumption;
        
        return {
          type: "Feature",
          properties: {
            provinceId: province._id,
            provinceName: province.name,
            provinceCode: province.code,
            year: yearInt,
            produksiBeras: production,
            konsumsiBeras: consumption,
            balance: balance,
            balanceType: balance > 0 ? 'surplus' : balance < 0 ? 'deficit' : 'balanced'
          },
          geometry: province.geoData.geometry
        };
      });
    
    const geoJsonResponse = {
      type: "FeatureCollection",
      features: features,
      metadata: {
        year: yearInt,
        totalProvinces: features.length,
        dataType: 'supply_chain'
      }
    };
    
    return res.status(200).json({
      success: true,
      data: geoJsonResponse
    });
    
  } catch (error) {
    console.error('Error getting supply chain map data:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting supply chain map data',
      error: error.message
    });
  }
});

/**
 * Get map data for province connections visualization
 */
export const getConnectionsMapData = asyncHandler(async (req, res) => {
  const { year } = req.params;
  
  // Validate year
  const yearInt = parseInt(year, 10);
  if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
    return res.status(400).json({
      success: false,
      message: 'Invalid year. Year must be between 2000 and 2100'
    });
  }
  
  try {
    // Get all connections for the year
    const connections = await ProvinceConnection.find({ year: yearInt })
      .populate('sourceProvinceId targetProvinceId', 'name code geoData');
    
    if (connections.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No connections found for year ${yearInt}`,
        year: yearInt
      });
    }
    
    // Get all provinces with geoData
    const provinces = await Province.find(
      { geoData: { $exists: true, $ne: null } },
      'name code geoData'
    );
    
    // Calculate connection statistics for each province
    const provinceStats = {};
    provinces.forEach(province => {
      provinceStats[province.name] = {
        provinceId: province._id,
        provinceName: province.name,
        provinceCode: province.code,
        outgoingConnections: 0,
        incomingConnections: 0,
        totalConnections: 0,
        geoData: province.geoData
      };
    });
    
    // Process connections
    connections.forEach(conn => {
      const sourceName = conn.sourceProvinceId.name;
      const targetName = conn.targetProvinceId.name;
      
      if (provinceStats[sourceName]) {
        provinceStats[sourceName].outgoingConnections++;
      }
      
      if (provinceStats[targetName]) {
        provinceStats[targetName].incomingConnections++;
      }
    });
    
    // Build GeoJSON FeatureCollection for provinces
    const features = Object.values(provinceStats)
      .filter(stats => stats.geoData)
      .map(stats => {
        stats.totalConnections = stats.outgoingConnections + stats.incomingConnections;
        
        return {
          type: "Feature",
          properties: {
            provinceId: stats.provinceId,
            provinceName: stats.provinceName,
            provinceCode: stats.provinceCode,
            year: yearInt,
            outgoingConnections: stats.outgoingConnections,
            incomingConnections: stats.incomingConnections,
            totalConnections: stats.totalConnections
          },
          geometry: stats.geoData.geometry
        };
      });
    
    // Build connections array for lines/arrows
    const connectionLines = connections
      .filter(conn => conn.sourceProvinceId.geoData && conn.targetProvinceId.geoData)
      .map(conn => ({
        connectionId: conn._id,
        source: {
          provinceId: conn.sourceProvinceId._id,
          provinceName: conn.sourceProvinceId.name,
          provinceCode: conn.sourceProvinceId.code
        },
        target: {
          provinceId: conn.targetProvinceId._id,
          provinceName: conn.targetProvinceId.name,
          provinceCode: conn.targetProvinceId.code
        },
        year: conn.year
      }));
    
    const geoJsonResponse = {
      type: "FeatureCollection",
      features: features,
      connections: connectionLines,
      metadata: {
        year: yearInt,
        totalProvinces: features.length,
        totalConnections: connections.length,
        dataType: 'province_connections'
      }
    };
    
    return res.status(200).json({
      success: true,
      data: geoJsonResponse
    });
    
  } catch (error) {
    console.error('Error getting connections map data:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting connections map data',
      error: error.message
    });
  }
});

/**
 * Get combined map data (food security + supply chain)
 */
export const getCombinedMapData = asyncHandler(async (req, res) => {
  const { year } = req.params;
  
  // Validate year
  const yearInt = parseInt(year, 10);
  if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
    return res.status(400).json({
      success: false,
      message: 'Invalid year. Year must be between 2000 and 2100'
    });
  }
  
  try {
    // Get both food security and supply chain data
    const [foodSecurityData, supplyChainData, provinces] = await Promise.all([
      FoodSecurity.find({ tahun: yearInt }),
      SupplyChain.find({ tahun: yearInt }),
      Province.find({ geoData: { $exists: true, $ne: null } }, 'name code geoData')
    ]);
    
    // Create maps for quick lookup
    const foodSecurityMap = {};
    const supplyChainMap = {};
    
    foodSecurityData.forEach(item => {
      foodSecurityMap[item.provinsi] = item;
    });
    
    supplyChainData.forEach(item => {
      supplyChainMap[item.provinsi] = item;
    });
    
    // Build combined features
    const features = provinces
      .filter(province => foodSecurityMap[province.name] || supplyChainMap[province.name])
      .map(province => {
        const fsData = foodSecurityMap[province.name];
        const scData = supplyChainMap[province.name];
        
        const properties = {
          provinceId: province._id,
          provinceName: province.name,
          provinceCode: province.code,
          year: yearInt
        };
        
        // Add food security data if available
        if (fsData) {
          properties.foodSecurity = {
            index: fsData.dependent_variable.indeks_ketahanan_pangan,
            category: fsData.kategori_ketahanan_pangan
          };
        }
        
        // Add supply chain data if available
        if (scData) {
          const production = scData.produksiBeras || 0;
          const consumption = scData.konsumsiBeras || 0;
          properties.supplyChain = {
            produksiBeras: production,
            konsumsiBeras: consumption,
            balance: production - consumption,
            balanceType: production > consumption ? 'surplus' : production < consumption ? 'deficit' : 'balanced'
          };
        }
        
        return {
          type: "Feature",
          properties: properties,
          geometry: province.geoData.geometry
        };
      });
    
    const geoJsonResponse = {
      type: "FeatureCollection",
      features: features,
      metadata: {
        year: yearInt,
        totalProvinces: features.length,
        dataType: 'combined'
      }
    };
    
    return res.status(200).json({
      success: true,
      data: geoJsonResponse
    });
    
  } catch (error) {
    console.error('Error getting combined map data:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting combined map data',
      error: error.message
    });
  }
});
