import mongoose from 'mongoose';
import Province from '../models/province.model.js';
import FoodSecurity from '../models/foodsecurity.model.js';
import SupplyChain from '../models/supplychain.model.js';
import ProvinceConnection from '../models/provinceConnection.model.js';
import asyncHandler from '../utils/asyncHandler.js';

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
            category: fsData.kategori_ketahanan_pangan,
            independentVariables: fsData.independent_variables,
            createdAt: fsData.createdAt,
            updatedAt: fsData.updatedAt
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
        dataType: 'food_security',
        category: category || 'all'
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
    console.log(`[DEBUG] Found ${supplyChainData.length} supply chain records`);
    
    // Get all provinces with geoData
    const provinces = await Province.find(
      { geoData: { $exists: true, $ne: null } },
      'name code geoData'
    );
    console.log(`[DEBUG] Found ${provinces.length} provinces with geoData`);
    
    // If no supply chain data found, return available years
    if (supplyChainData.length === 0) {
      const availableYears = await SupplyChain.distinct('tahun');
      console.log(`[DEBUG] Available years in supply chain: ${availableYears}`);
      
      return res.status(404).json({
        success: false,
        message: `No supply chain data found for year ${yearInt}`,
        year: yearInt,
        availableYears: availableYears.sort(),
        totalSupplyChainRecords: await SupplyChain.countDocuments(),
        totalProvincesWithGeoData: provinces.length
      });
    }
    
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
            mpp: scData.mpp,
            jumlahRantai: scData.jumlahRantai,
            produksiBeras: production,
            konsumsiBeras: consumption,
            balance: balance,
            balanceType: balance > 0 ? 'surplus' : balance < 0 ? 'deficit' : 'balanced',
            createdAt: scData.createdAt,
            updatedAt: scData.updatedAt
          },
          geometry: province.geoData.geometry
        };
      });
    
    console.log(`[DEBUG] Created ${features.length} features for map`);
    
    const geoJsonResponse = {
      type: "FeatureCollection",
      features: features,
      metadata: {
        year: yearInt,
        totalProvinces: features.length,
        dataType: 'supply_chain',
        condition: condition || 'all',
        debug: {
          supplyChainRecordsFound: supplyChainData.length,
          provincesWithGeoData: provinces.length,
          matchedProvinces: features.length
        }
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
        connectedProvinces: new Set(),
        geoData: province.geoData
      };
    });
    
    // Process connections
    connections.forEach(conn => {
      const sourceName = conn.sourceProvinceId.name;
      const targetName = conn.targetProvinceId.name;
      
      if (provinceStats[sourceName]) {
        provinceStats[sourceName].outgoingConnections++;
        provinceStats[sourceName].connectedProvinces.add(targetName);
      }
      
      if (provinceStats[targetName]) {
        provinceStats[targetName].incomingConnections++;
        provinceStats[targetName].connectedProvinces.add(sourceName);
      }
    });
    
    // Build GeoJSON FeatureCollection for provinces
    const features = Object.values(provinceStats)
      .filter(stats => stats.geoData)
      .map(stats => {
        stats.totalConnections = stats.outgoingConnections + stats.incomingConnections;
        stats.uniqueConnections = stats.connectedProvinces.size;
        
        return {
          type: "Feature",
          properties: {
            provinceId: stats.provinceId,
            provinceName: stats.provinceName,
            provinceCode: stats.provinceCode,
            year: yearInt,
            outgoingConnections: stats.outgoingConnections,
            incomingConnections: stats.incomingConnections,
            totalConnections: stats.totalConnections,
            uniqueConnections: stats.uniqueConnections
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
            category: fsData.kategori_ketahanan_pangan,
            independentVariables: fsData.independent_variables
          };
        }
        
        // Add supply chain data if available
        if (scData) {
          const production = scData.produksiBeras || 0;
          const consumption = scData.konsumsiBeras || 0;
          properties.supplyChain = {
            mpp: scData.mpp,
            jumlahRantai: scData.jumlahRantai,
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
        dataType: 'combined',
        foodSecurityCount: foodSecurityData.length,
        supplyChainCount: supplyChainData.length
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
 * Get debug information for map data
 */
export const getMapDebugInfo = asyncHandler(async (req, res) => {
  try {
    // Get counts of all relevant data
    const [
      totalProvinces,
      provincesWithGeoData,
      totalFoodSecurity,
      totalSupplyChain,
      totalConnections,
      availableYearsFoodSecurity,
      availableYearsSupplyChain,
      availableYearsConnections
    ] = await Promise.all([
      Province.countDocuments(),
      Province.countDocuments({ geoData: { $exists: true, $ne: null } }),
      FoodSecurity.countDocuments(),
      SupplyChain.countDocuments(),
      ProvinceConnection.countDocuments(),
      FoodSecurity.distinct('tahun'),
      SupplyChain.distinct('tahun'),
      ProvinceConnection.distinct('year')
    ]);

    // Get sample province names to check data mapping
    const sampleProvinces = await Province.find({}, 'name').limit(5);
    const sampleFoodSecurity = await FoodSecurity.find({}, 'provinsi tahun').limit(5);
    const sampleSupplyChain = await SupplyChain.find({}, 'provinsi tahun').limit(5);

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalProvinces,
          provincesWithGeoData,
          totalFoodSecurity,
          totalSupplyChain,
          totalConnections
        },
        availableYears: {
          foodSecurity: availableYearsFoodSecurity.sort(),
          supplyChain: availableYearsSupplyChain.sort(),
          connections: availableYearsConnections.sort()
        },
        samples: {
          provinces: sampleProvinces,
          foodSecurity: sampleFoodSecurity,
          supplyChain: sampleSupplyChain
        }
      }
    });
  } catch (error) {
    console.error('Error getting map debug info:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting map debug info',
      error: error.message
    });
  }
});

/**
 * Get comprehensive province data for map interaction
 * Returns all data related to a specific province: food security, supply chain, connections
 */
export const getProvinceMapDetails = asyncHandler(async (req, res) => {
  const { id: provinceId } = req.params;
  const { year } = req.query;
  
  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(provinceId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid province ID format'
    });
  }
  
  try {
    // Verify province exists
    const province = await Province.findById(provinceId);
    if (!province) {
      return res.status(404).json({
        success: false,
        message: 'Province not found'
      });
    }
    
    // Build base query for year filter
    let yearQuery = {};
    let yearInt = null;
    if (year) {
      yearInt = parseInt(year, 10);
      if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
        return res.status(400).json({
          success: false,
          message: 'Invalid year. Year must be between 2000 and 2100'
        });
      }
      yearQuery = { tahun: yearInt };
    }
    
    // Get all related data in parallel
    const [
      foodSecurityData,
      supplyChainData,
      outgoingConnections,
      incomingConnections,
      availableYearsFoodSecurity,
      availableYearsSupplyChain,
      availableYearsConnections
    ] = await Promise.all([
      // Food security data
      FoodSecurity.find({ 
        provinsi: province.name, 
        ...yearQuery 
      }).sort({ tahun: -1 }),
      
      // Supply chain data
      SupplyChain.find({ 
        provinsi: province.name, 
        ...yearQuery 
      }).sort({ tahun: -1 }),
      
      // Outgoing connections (where this province is source)
      ProvinceConnection.find({ 
        sourceProvinceId: provinceId,
        ...(yearInt ? { year: yearInt } : {})
      }).populate('targetProvinceId', 'name code geoData'),
      
      // Incoming connections (where this province is target)
      ProvinceConnection.find({ 
        targetProvinceId: provinceId,
        ...(yearInt ? { year: yearInt } : {})
      }).populate('sourceProvinceId', 'name code geoData'),
      
      // Available years for each data type
      FoodSecurity.distinct('tahun', { provinsi: province.name }),
      SupplyChain.distinct('tahun', { provinsi: province.name }),
      ProvinceConnection.distinct('year', {
        $or: [
          { sourceProvinceId: provinceId },
          { targetProvinceId: provinceId }
        ]
      })
    ]);
    
    // Format the response
    const response = {
      province: {
        id: province._id,
        name: province.name,
        code: province.code,
        geoData: province.geoData,
        metadata: province.metadata
      },
      requestedYear: yearInt,
      availableYears: {
        foodSecurity: availableYearsFoodSecurity.sort(),
        supplyChain: availableYearsSupplyChain.sort(),
        connections: availableYearsConnections.sort()
      },
      data: {}
    };
    
    // Add food security data
    if (foodSecurityData.length > 0) {
      if (yearInt) {
        // Single year data
        response.data.foodSecurity = foodSecurityData[0] || null;
      } else {
        // Multi-year data with trend
        response.data.foodSecurity = {
          currentData: foodSecurityData[0] || null,
          historicalData: foodSecurityData,
          trend: foodSecurityData.map(item => ({
            year: item.tahun,
            index: item.dependent_variable.indeks_ketahanan_pangan,
            category: item.kategori_ketahanan_pangan
          }))
        };
      }
    } else {
      response.data.foodSecurity = null;
    }
    
    // Add supply chain data
    if (supplyChainData.length > 0) {
      if (yearInt) {
        // Single year data
        response.data.supplyChain = supplyChainData[0] || null;
      } else {
        // Multi-year data with trend
        response.data.supplyChain = {
          currentData: supplyChainData[0] || null,
          historicalData: supplyChainData,
          trend: supplyChainData.map(item => {
            const production = item.produksiBeras || 0;
            const consumption = item.konsumsiBeras || 0;
            return {
              year: item.tahun,
              production: production,
              consumption: consumption,
              balance: production - consumption,
              balanceType: production > consumption ? 'surplus' : production < consumption ? 'deficit' : 'balanced',
              mpp: item.mpp,
              jumlahRantai: item.jumlahRantai
            };
          })
        };
      }
    } else {
      response.data.supplyChain = null;
    }
    
    // Add connections data
    response.data.connections = {
      outgoing: {
        count: outgoingConnections.length,
        destinations: outgoingConnections.map(conn => ({
          connectionId: conn._id,
          targetProvince: {
            id: conn.targetProvinceId._id,
            name: conn.targetProvinceId.name,
            code: conn.targetProvinceId.code,
            hasGeoData: !!conn.targetProvinceId.geoData
          },
          year: conn.year,
          createdAt: conn.createdAt
        }))
      },
      incoming: {
        count: incomingConnections.length,
        sources: incomingConnections.map(conn => ({
          connectionId: conn._id,
          sourceProvince: {
            id: conn.sourceProvinceId._id,
            name: conn.sourceProvinceId.name,
            code: conn.sourceProvinceId.code,
            hasGeoData: !!conn.sourceProvinceId.geoData
          },
          year: conn.year,
          createdAt: conn.createdAt
        }))
      },
      summary: {
        totalOutgoing: outgoingConnections.length,
        totalIncoming: incomingConnections.length,
        totalConnections: outgoingConnections.length + incomingConnections.length,
        uniqueDestinations: [...new Set(outgoingConnections.map(c => c.targetProvinceId.name))].length,
        uniqueSources: [...new Set(incomingConnections.map(c => c.sourceProvinceId.name))].length
      }
    };
    
    // Add summary statistics
    response.summary = {
      hasData: {
        foodSecurity: foodSecurityData.length > 0,
        supplyChain: supplyChainData.length > 0,
        connections: (outgoingConnections.length + incomingConnections.length) > 0
      },
      dataCount: {
        foodSecurityRecords: foodSecurityData.length,
        supplyChainRecords: supplyChainData.length,
        totalConnections: outgoingConnections.length + incomingConnections.length
      }
    };
    
    return res.status(200).json({
      success: true,
      data: response
    });
    
  } catch (error) {
    console.error('Error getting province map details:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting province map details',
      error: error.message
    });
  }
});

/**
 * Get lightweight province data for map popup/tooltip
 * Optimized for quick display when hovering/clicking provinces
 */
export const getProvinceMapSummary = asyncHandler(async (req, res) => {
  const { id: provinceId } = req.params;
  const { year } = req.query;
  
  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(provinceId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid province ID format'
    });
  }
  
  try {
    // Verify province exists
    const province = await Province.findById(provinceId);
    if (!province) {
      return res.status(404).json({
        success: false,
        message: 'Province not found'
      });
    }
    
    // Build year query
    let yearQuery = {};
    let yearInt = null;
    if (year) {
      yearInt = parseInt(year, 10);
      if (!isNaN(yearInt) && yearInt >= 2000 && yearInt <= 2100) {
        yearQuery = { tahun: yearInt };
      }
    }
    
    // Get latest data for quick summary
    const [latestFoodSecurity, latestSupplyChain, connectionCount] = await Promise.all([
      FoodSecurity.findOne({ 
        provinsi: province.name, 
        ...yearQuery 
      }).sort({ tahun: -1 }),
      
      SupplyChain.findOne({ 
        provinsi: province.name, 
        ...yearQuery 
      }).sort({ tahun: -1 }),
      
      ProvinceConnection.countDocuments({
        $or: [
          { sourceProvinceId: provinceId },
          { targetProvinceId: provinceId }
        ],
        ...(yearInt ? { year: yearInt } : {})
      })
    ]);
    
    // Build summary response
    const summary = {
      province: {
        id: province._id,
        name: province.name,
        code: province.code
      },
      year: yearInt || (latestFoodSecurity?.tahun || latestSupplyChain?.tahun || null),
      foodSecurity: latestFoodSecurity ? {
        index: latestFoodSecurity.dependent_variable.indeks_ketahanan_pangan,
        category: latestFoodSecurity.kategori_ketahanan_pangan,
        year: latestFoodSecurity.tahun
      } : null,
      supplyChain: latestSupplyChain ? {
        production: latestSupplyChain.produksiBeras || 0,
        consumption: latestSupplyChain.konsumsiBeras || 0,
        balance: (latestSupplyChain.produksiBeras || 0) - (latestSupplyChain.konsumsiBeras || 0),
        balanceType: ((latestSupplyChain.produksiBeras || 0) - (latestSupplyChain.konsumsiBeras || 0)) > 0 ? 'surplus' : 'deficit',
        mpp: latestSupplyChain.mpp,
        year: latestSupplyChain.tahun
      } : null,
      connections: {
        total: connectionCount,
        hasConnections: connectionCount > 0
      }
    };
    
    return res.status(200).json({
      success: true,
      data: summary
    });
    
  } catch (error) {
    console.error('Error getting province map summary:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting province map summary',
      error: error.message
    });
  }
});

/**
 * Get province data by ID with flexible filtering
 * Supports multiple data types and year filtering
 * Query params: types (geojson,food-security,supply-chain,connections), year
 */
export const getProvinceMapDataById = asyncHandler(async (req, res) => {
  const { id: provinceId } = req.params;
  const { types, year } = req.query;
  
  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(provinceId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid province ID format'
    });
  }
  
  // Parse requested data types
  let requestedTypes = types ? types.split(',').map(t => t.trim().toLowerCase()) : ['geojson'];
  const validTypes = ['geojson', 'food-security', 'supply-chain', 'connections'];
  const invalidTypes = requestedTypes.filter(type => !validTypes.includes(type));
  
  if (invalidTypes.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Invalid data types: ${invalidTypes.join(', ')}. Valid types: ${validTypes.join(', ')}`
    });
  }
  
  // Auto-include geojson if other data types are requested and geojson is not explicitly included
  const hasOtherTypes = requestedTypes.some(type => type !== 'geojson');
  if (hasOtherTypes && !requestedTypes.includes('geojson')) {
    requestedTypes.push('geojson');
  }
  
  // Validate year if provided
  let yearInt = null;
  if (year) {
    yearInt = parseInt(year, 10);
    if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid year. Year must be between 2000 and 2100'
      });
    }
  }
  
  try {
    // Get province info
    const province = await Province.findById(provinceId);
    if (!province) {
      return res.status(404).json({
        success: false,
        message: 'Province not found'
      });
    }
    
    const response = {
      provinceId: province._id,
      provinceName: province.name,
      provinceCode: province.code,
      requestedYear: yearInt,
      requestedTypes: requestedTypes,
      data: {}
    };
    
    // Build parallel queries based on requested types
    const queries = {};
    
    if (requestedTypes.includes('food-security')) {
      const fsQuery = { provinsi: province.name };
      if (yearInt) fsQuery.tahun = yearInt;
      
      queries.foodSecurity = FoodSecurity.find(fsQuery).sort({ tahun: -1 });
    }
    
    if (requestedTypes.includes('supply-chain')) {
      const scQuery = { provinsi: province.name };
      if (yearInt) scQuery.tahun = yearInt;
      
      queries.supplyChain = SupplyChain.find(scQuery).sort({ tahun: -1 });
    }
    
    if (requestedTypes.includes('connections')) {
      const connQuery = {
        $or: [
          { sourceProvinceId: provinceId },
          { targetProvinceId: provinceId }
        ]
      };
      if (yearInt) connQuery.year = yearInt;
      
      queries.outgoingConnections = ProvinceConnection.find({
        sourceProvinceId: provinceId,
        ...(yearInt ? { year: yearInt } : {})
      }).populate('targetProvinceId', 'name code');
      
      queries.incomingConnections = ProvinceConnection.find({
        targetProvinceId: provinceId,
        ...(yearInt ? { year: yearInt } : {})
      }).populate('sourceProvinceId', 'name code');
    }
    
    // Execute all queries in parallel
    const results = await Promise.all(Object.values(queries));
    const resultKeys = Object.keys(queries);
    const queryResults = {};
    
    resultKeys.forEach((key, index) => {
      queryResults[key] = results[index];
    });
    
    // Build GeoJSON if requested
    if (requestedTypes.includes('geojson')) {
      if (!province.geoData) {
        response.data.geojson = null;
        response.warnings = response.warnings || [];
        response.warnings.push('Province has no geographic data');
      } else {
        const properties = {
          provinceId: province._id,
          provinceName: province.name,
          provinceCode: province.code
        };
        
        // Add latest data from other requested types to GeoJSON properties
        if (queryResults.foodSecurity && queryResults.foodSecurity.length > 0) {
          const latestFS = queryResults.foodSecurity[0];
          properties.foodSecurity = {
            year: latestFS.tahun,
            index: latestFS.dependent_variable.indeks_ketahanan_pangan,
            category: latestFS.kategori_ketahanan_pangan
          };
        }
        
        if (queryResults.supplyChain && queryResults.supplyChain.length > 0) {
          const latestSC = queryResults.supplyChain[0];
          const production = latestSC.produksiBeras || 0;
          const consumption = latestSC.konsumsiBeras || 0;
          properties.supplyChain = {
            year: latestSC.tahun,
            production: production,
            consumption: consumption,
            balance: production - consumption,
            balanceType: production > consumption ? 'surplus' : production < consumption ? 'deficit' : 'balanced',
            mpp: latestSC.mpp,
            jumlahRantai: latestSC.jumlahRantai
          };
        }
        
        if (queryResults.outgoingConnections || queryResults.incomingConnections) {
          const outgoing = queryResults.outgoingConnections || [];
          const incoming = queryResults.incomingConnections || [];
          properties.connections = {
            outgoing: outgoing.length,
            incoming: incoming.length,
            total: outgoing.length + incoming.length
          };
        }
        
        response.data.geojson = {
          type: "Feature",
          properties: properties,
          geometry: province.geoData.geometry
        };
      }
    }
    
    // Add food security data if requested
    if (requestedTypes.includes('food-security')) {
      const fsData = queryResults.foodSecurity || [];
      if (yearInt && fsData.length > 0) {
        // Single year data
        response.data.foodSecurity = fsData[0];
      } else if (!yearInt && fsData.length > 0) {
        // Multi-year data
        response.data.foodSecurity = {
          latest: fsData[0],
          historical: fsData,
          availableYears: fsData.map(item => item.tahun).sort((a, b) => b - a)
        };
      } else {
        response.data.foodSecurity = null;
      }
    }
    
    // Add supply chain data if requested
    if (requestedTypes.includes('supply-chain')) {
      const scData = queryResults.supplyChain || [];
      if (yearInt && scData.length > 0) {
        // Single year data
        response.data.supplyChain = scData[0];
      } else if (!yearInt && scData.length > 0) {
        // Multi-year data
        response.data.supplyChain = {
          latest: scData[0],
          historical: scData,
          availableYears: scData.map(item => item.tahun).sort((a, b) => b - a)
        };
      } else {
        response.data.supplyChain = null;
      }
    }
    
    // Add connections data if requested
    if (requestedTypes.includes('connections')) {
      const outgoing = queryResults.outgoingConnections || [];
      const incoming = queryResults.incomingConnections || [];
      
      response.data.connections = {
        outgoing: {
          count: outgoing.length,
          connections: outgoing.map(conn => ({
            connectionId: conn._id,
            targetProvince: {
              id: conn.targetProvinceId._id,
              name: conn.targetProvinceId.name,
              code: conn.targetProvinceId.code
            },
            year: conn.year,
            createdAt: conn.createdAt
          }))
        },
        incoming: {
          count: incoming.length,
          connections: incoming.map(conn => ({
            connectionId: conn._id,
            sourceProvince: {
              id: conn.sourceProvinceId._id,
              name: conn.sourceProvinceId.name,
              code: conn.sourceProvinceId.code
            },
            year: conn.year,
            createdAt: conn.createdAt
          }))
        },
        summary: {
          totalOutgoing: outgoing.length,
          totalIncoming: incoming.length,
          totalConnections: outgoing.length + incoming.length,
          availableYears: yearInt ? [yearInt] : [
            ...new Set([...outgoing, ...incoming].map(c => c.year))
          ].sort((a, b) => b - a)
        }
      };
    }
    
    // Add metadata
    response.metadata = {
      requestTimestamp: new Date().toISOString(),
      dataTypes: requestedTypes,
      yearFilter: yearInt,
      hasGeoData: !!province.geoData
    };
    
    return res.status(200).json({
      success: true,
      data: response
    });
    
  } catch (error) {
    console.error('Error getting province data by ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting province data by ID',
      error: error.message
    });
  }
});

/**
 * Get multiple provinces data with filtering
 * Supports bulk operations for multiple province IDs
 */
export const getMultipleProvincesMapData = asyncHandler(async (req, res) => {
  const { ids, types, year } = req.query;
  
  if (!ids) {
    return res.status(400).json({
      success: false,
      message: 'Province IDs are required. Use ?ids=id1,id2,id3'
    });
  }
  
  // Parse province IDs
  const provinceIds = ids.split(',').map(id => id.trim());
  const invalidIds = provinceIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
  
  if (invalidIds.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Invalid province ID format: ${invalidIds.join(', ')}`
    });
  }
  
  // Limit number of provinces for performance
  if (provinceIds.length > 50) {
    return res.status(400).json({
      success: false,
      message: 'Maximum 50 provinces allowed per request'
    });
  }
  
  // Parse requested data types
  const requestedTypes = types ? types.split(',').map(t => t.trim().toLowerCase()) : ['geojson'];
  const validTypes = ['geojson', 'food-security', 'supply-chain', 'connections'];
  const invalidTypes = requestedTypes.filter(type => !validTypes.includes(type));
  
  if (invalidTypes.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Invalid data types: ${invalidTypes.join(', ')}. Valid types: ${validTypes.join(', ')}`
    });
  }
  
  // Validate year if provided
  let yearInt = null;
  if (year) {
    yearInt = parseInt(year, 10);
    if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid year. Year must be between 2000 and 2100'
      });
    }
  }
  
  try {
    // Get all provinces
    const provinces = await Province.find({ _id: { $in: provinceIds } });
    const foundIds = provinces.map(p => p._id.toString());
    const notFoundIds = provinceIds.filter(id => !foundIds.includes(id));
    
    if (provinces.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No provinces found'
      });
    }
    
    // Create province name to ID mapping
    const provinceNameMap = {};
    provinces.forEach(p => {
      provinceNameMap[p.name] = p._id.toString();
    });
    
    // Build queries for all requested data types
    const queries = {};
    
    if (requestedTypes.includes('food-security')) {
      const fsQuery = { provinsi: { $in: provinces.map(p => p.name) } };
      if (yearInt) fsQuery.tahun = yearInt;
      queries.foodSecurity = FoodSecurity.find(fsQuery).sort({ tahun: -1 });
    }
    
    if (requestedTypes.includes('supply-chain')) {
      const scQuery = { provinsi: { $in: provinces.map(p => p.name) } };
      if (yearInt) scQuery.tahun = yearInt;
      queries.supplyChain = SupplyChain.find(scQuery).sort({ tahun: -1 });
    }
    
    if (requestedTypes.includes('connections')) {
      const connQuery = {
        $or: [
          { sourceProvinceId: { $in: provinceIds } },
          { targetProvinceId: { $in: provinceIds } }
        ]
      };
      if (yearInt) connQuery.year = yearInt;
      
      queries.connections = ProvinceConnection.find(connQuery)
        .populate('sourceProvinceId targetProvinceId', 'name code');
    }
    
    // Execute all queries
    const results = await Promise.all(Object.values(queries));
    const resultKeys = Object.keys(queries);
    const queryResults = {};
    
    resultKeys.forEach((key, index) => {
      queryResults[key] = results[index];
    });
    
    // Group data by province
    const provinceData = {};
    
    provinces.forEach(province => {
      provinceData[province._id.toString()] = {
        provinceId: province._id,
        provinceName: province.name,
        provinceCode: province.code,
        data: {}
      };
    });
    
    // Process results and group by province
    if (queryResults.foodSecurity) {
      queryResults.foodSecurity.forEach(fs => {
        const provinceId = provinceNameMap[fs.provinsi];
        if (provinceId && provinceData[provinceId]) {
          if (!provinceData[provinceId].data.foodSecurity) {
            provinceData[provinceId].data.foodSecurity = [];
          }
          provinceData[provinceId].data.foodSecurity.push(fs);
        }
      });
    }
    
    if (queryResults.supplyChain) {
      queryResults.supplyChain.forEach(sc => {
        const provinceId = provinceNameMap[sc.provinsi];
        if (provinceId && provinceData[provinceId]) {
          if (!provinceData[provinceId].data.supplyChain) {
            provinceData[provinceId].data.supplyChain = [];
          }
          provinceData[provinceId].data.supplyChain.push(sc);
        }
      });
    }
    
    if (queryResults.connections) {
      queryResults.connections.forEach(conn => {
        const sourceId = conn.sourceProvinceId._id.toString();
        const targetId = conn.targetProvinceId._id.toString();
        
        // Add to source province's outgoing connections
        if (provinceData[sourceId]) {
          if (!provinceData[sourceId].data.outgoingConnections) {
            provinceData[sourceId].data.outgoingConnections = [];
          }
          provinceData[sourceId].data.outgoingConnections.push(conn);
        }
        
        // Add to target province's incoming connections
        if (provinceData[targetId]) {
          if (!provinceData[targetId].data.incomingConnections) {
            provinceData[targetId].data.incomingConnections = [];
          }
          provinceData[targetId].data.incomingConnections.push(conn);
        }
      });
    }
    
    // Build final response
    const responseData = Object.values(provinceData);
    
    // Add GeoJSON if requested
    if (requestedTypes.includes('geojson')) {
      const features = provinces
        .filter(p => p.geoData)
        .map(province => {
          const data = provinceData[province._id.toString()];
          const properties = {
            provinceId: province._id,
            provinceName: province.name,
            provinceCode: province.code
          };
          
          // Add summary data to properties
          if (data.data.foodSecurity && data.data.foodSecurity.length > 0) {
            const latest = data.data.foodSecurity[0];
            properties.foodSecurity = {
              index: latest.dependent_variable.indeks_ketahanan_pangan,
              category: latest.kategori_ketahanan_pangan,
              year: latest.tahun
            };
          }
          
          if (data.data.supplyChain && data.data.supplyChain.length > 0) {
            const latest = data.data.supplyChain[0];
            const production = latest.produksiBeras || 0;
            const consumption = latest.konsumsiBeras || 0;
            properties.supplyChain = {
              production,
              consumption,
              balance: production - consumption,
              balanceType: production > consumption ? 'surplus' : production < consumption ? 'deficit' : 'balanced',
              year: latest.tahun
            };
          }
          
          return {
            type: "Feature",
            properties,
            geometry: province.geoData.geometry
          };
        });
      
      responseData.forEach(data => {
        const province = provinces.find(p => p._id.toString() === data.provinceId.toString());
        if (province && province.geoData) {
          data.data.geojson = features.find(f => f.properties.provinceId.toString() === data.provinceId.toString());
        }
      });
    }
    
    return res.status(200).json({
      success: true,
      data: {
        provinces: responseData,
        metadata: {
          requestedProvinces: provinceIds.length,
          foundProvinces: provinces.length,
          notFoundIds: notFoundIds,
          requestedTypes: requestedTypes,
          yearFilter: yearInt,
          requestTimestamp: new Date().toISOString()
        }
      }
    });
    
  } catch (error) {
    console.error('Error getting multiple provinces data:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting multiple provinces data',
      error: error.message
    });
  }
});
