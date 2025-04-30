import Province from '../models/province.model.js';
import ProvinceConnection from '../models/provinceConnection.model.js';
import mongoose from 'mongoose';

// Get all provinces
export const getAllProvinces = async (req, res) => {
  try {
    const provinces = await Province.find({}, 'name code');
    return res.status(200).json({
      success: true,
      data: provinces
    });
  } catch (error) {
    console.error('Error fetching provinces:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching provinces',
      error: error.message
    });
  }
};

// Initialize provinces from geojson data
export const initializeProvinces = async (req, res) => {
  try {
    const provinces = await Province.initializeFromGeoJSON();
    return res.status(200).json({
      success: true,
      message: 'Provinces initialized successfully',
      count: provinces.length,
      data: provinces.map(p => ({ id: p._id, name: p.name, code: p.code }))
    });
  } catch (error) {
    console.error('Error initializing provinces:', error);
    return res.status(500).json({
      success: false,
      message: 'Error initializing provinces',
      error: error.message
    });
  }
};

// Get province by ID
export const getProvinceById = async (req, res) => {
  try {
    const province = await Province.findById(req.params.id);
    if (!province) {
      return res.status(404).json({
        success: false,
        message: 'Province not found'
      });
    }
    return res.status(200).json({
      success: true,
      data: province
    });
  } catch (error) {
    console.error('Error fetching province:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching province',
      error: error.message
    });
  }
};

// Create a new connection between provinces
export const createConnection = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { 
      sourceProvinceId, 
      targetProvinceId, 
      year
    } = req.body;

    // Validate input
    if (!sourceProvinceId || !targetProvinceId) {
      return res.status(400).json({
        success: false,
        message: 'Source and target province IDs are required'
      });
    }

    if (!year) {
      return res.status(400).json({
        success: false,
        message: 'Year is required'
      });
    }

    // Check if source and target are the same
    if (sourceProvinceId === targetProvinceId) {
      return res.status(400).json({
        success: false,
        message: 'Source and target provinces cannot be the same'
      });
    }

    // Check if provinces exist
    const sourceProvince = await Province.findById(sourceProvinceId);
    const targetProvince = await Province.findById(targetProvinceId);

    if (!sourceProvince || !targetProvince) {
      return res.status(404).json({
        success: false,
        message: 'One or both provinces not found'
      });
    }

    // Check if connection already exists
    let connection = await ProvinceConnection.findOne({
      sourceProvinceId,
      targetProvinceId,
      year
    });

    let isNew = false;

    if (connection) {
      await connection.save({ session });
    } else {
      // Create new connection
      isNew = true;
      connection = await ProvinceConnection.create([{
        sourceProvinceId,
        targetProvinceId,
        year
      }], { session });
      connection = connection[0]; // Extract from array returned by create
    }
    
    await session.commitTransaction();
    session.endSession();
    
    return res.status(isNew ? 201 : 200).json({
      success: true,
      message: isNew ? 'Connection created successfully' : 'Connection updated successfully',
      data: {
        id: connection._id,
        sourceProvince: {
          id: sourceProvince._id,
          name: sourceProvince.name
        },
        targetProvince: {
          id: targetProvince._id,
          name: targetProvince.name
        },
        year
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    // Handle duplicate key error from MongoDB
    if ((error.name === 'MongoError' || error.name === 'MongoServerError') && error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A connection between these provinces for this year already exists'
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    console.error('Error creating/updating connection:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating/updating connection',
      error: error.message
    });
  }
};

// Update an existing connection
export const updateConnection = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { connectionId } = req.params;
    
    const connection = await ProvinceConnection.findById(connectionId);
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Connection not found'
      });
    }
    
    // No fields to update since we removed volume and value
    await connection.save({ session });
    
    // Get province details for response
    const sourceProvince = await Province.findById(connection.sourceProvinceId);
    const targetProvince = await Province.findById(connection.targetProvinceId);
    
    await session.commitTransaction();
    session.endSession();
    
    return res.status(200).json({
      success: true,
      message: 'Connection updated successfully',
      data: {
        id: connection._id,
        sourceProvince: {
          id: sourceProvince._id,
          name: sourceProvince.name
        },
        targetProvince: {
          id: targetProvince._id,
          name: targetProvince.name
        },
        year: connection.year
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error updating connection:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating connection',
      error: error.message
    });
  }
};

// Get connections for a specific province
export const getProvinceConnections = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province ID format'
      });
    }

    // Find all connections where this province is either source or target
    const connections = await ProvinceConnection.find({
      $or: [
        { sourceProvinceId: id },
        { targetProvinceId: id }
      ]
    }).populate('sourceProvinceId targetProvinceId', 'name code');

    if (!connections || connections.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'No connections found for this province'
      });
    }

    return res.status(200).json({
      success: true,
      count: connections.length,
      data: connections
    });
  } catch (error) {
    console.error('Error getting province connections:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Delete a connection
export const deleteConnection = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { connectionId } = req.params;
    
    const deletedConnection = await ProvinceConnection.findByIdAndDelete(connectionId).session(session);
    
    if (!deletedConnection) {
      return res.status(404).json({
        success: false,
        message: 'Connection not found'
      });
    }
    
    await session.commitTransaction();
    session.endSession();
    
    return res.status(200).json({
      success: true,
      message: 'Connection deleted successfully'
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error deleting connection:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting connection',
      error: error.message
    });
  }
};

// Get province GeoJSON data
export const getProvinceGeoJSON = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province ID format'
      });
    }

    const province = await Province.findById(id);
    
    if (!province) {
      return res.status(404).json({
        success: false,
        message: 'Province not found'
      });
    }

    // Check if province has geojson data
    if (!province.geojson) {
      return res.status(404).json({
        success: false,
        message: 'No GeoJSON data found for this province'
      });
    }

    return res.status(200).json({
      success: true,
      data: province.geojson
    });
  } catch (error) {
    console.error('Error getting province GeoJSON:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get province polygon data 
export const getProvincePolygon = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province ID format'
      });
    }

    const province = await Province.findById(id);
    
    if (!province) {
      return res.status(404).json({
        success: false,
        message: 'Province not found'
      });
    }

    // Check if province has polygon data
    if (!province.polygon) {
      return res.status(404).json({
        success: false,
        message: 'No polygon data found for this province'
      });
    }

    return res.status(200).json({
      success: true,
      data: province.polygon
    });
  } catch (error) {
    console.error('Error getting province polygon:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get trade matrix for a specific year
export const getTradeMatrix = async (req, res) => {
  try {
    const { year } = req.params;
    
    // Validate year
    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid year format or range'
      });
    }

    // Get all provinces for the matrix
    const provinces = await Province.find({}, 'name code');
    
    if (!provinces || provinces.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No provinces found'
      });
    }

    // Get all connections for the specified year
    const connections = await ProvinceConnection.find({ year: yearNum })
      .populate('sourceProvinceId targetProvinceId', 'name code');

    // Create the trade matrix
    const matrix = {
      provinces: provinces,
      connections: connections,
      year: yearNum
    };

    return res.status(200).json({
      success: true,
      data: matrix
    });
  } catch (error) {
    console.error('Error getting trade matrix:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get aggregate statistics
export const getConnectionStatistics = async (req, res) => {
  try {
    // Get total connections count
    const totalConnections = await ProvinceConnection.countDocuments();
    
    // Get unique years
    const years = await ProvinceConnection.distinct('year');
    
    // Get connections by year count
    const connectionsByYear = [];
    for (const year of years) {
      const count = await ProvinceConnection.countDocuments({ year });
      connectionsByYear.push({ year, count });
    }
    
    // Get top connected provinces (provinces with most connections)
    const provinces = await Province.find({}, 'name code');
    const provinceStats = [];
    
    for (const province of provinces) {
      const sourceCount = await ProvinceConnection.countDocuments({ sourceProvinceId: province._id });
      const targetCount = await ProvinceConnection.countDocuments({ targetProvinceId: province._id });
      
      provinceStats.push({
        province: {
          _id: province._id,
          name: province.name,
          code: province.code
        },
        connectionsAsSource: sourceCount,
        connectionsAsTarget: targetCount,
        totalConnections: sourceCount + targetCount
      });
    }
    
    // Sort provinces by total connections
    provinceStats.sort((a, b) => b.totalConnections - a.totalConnections);
    
    const statistics = {
      totalConnections,
      years,
      connectionsByYear,
      provinceStats: provinceStats.slice(0, 10) // Just get top 10
    };

    return res.status(200).json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Error getting connection statistics:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Bulk import connections
export const bulkImportConnections = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { connections } = req.body;
    
    if (!connections || !Array.isArray(connections) || connections.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid connections array is required'
      });
    }
    
    const result = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: []
    };
    
    // Process each connection
    for (const conn of connections) {
      try {
        const { sourceProvinceId, targetProvinceId, year } = conn;
        
        // Validate required fields
        if (!sourceProvinceId || !targetProvinceId || !year) {
          throw new Error('Missing required fields');
        }
        
        // Check if source and target are the same
        if (sourceProvinceId === targetProvinceId) {
          throw new Error('Source and target provinces cannot be the same');
        }
        
        // Check if provinces exist
        const sourceProvince = await Province.findById(sourceProvinceId);
        const targetProvince = await Province.findById(targetProvinceId);
        
        if (!sourceProvince || !targetProvince) {
          throw new Error(`One or both provinces not found`);
        }
        
        // Check if connection already exists
        const existingConnection = await ProvinceConnection.findOne({
          sourceProvinceId,
          targetProvinceId,
          year
        });
        
        if (existingConnection) {
          // Update existing connection
          await existingConnection.save({ session });
          result.updated++;
        } else {
          // Create new connection
          await ProvinceConnection.create([{
            sourceProvinceId,
            targetProvinceId,
            year
          }], { session });
          result.created++;
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          connection: conn,
          error: error.message
        });
      }
    }
    
    await session.commitTransaction();
    session.endSession();
    
    return res.status(200).json({
      success: true,
      message: 'Bulk import completed',
      result
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error bulk importing connections:', error);
    return res.status(500).json({
      success: false,
      message: 'Error bulk importing connections',
      error: error.message
    });
  }
};
