import SupplyChain from '../models/supplychain.model.js';
import Province from '../models/province.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import mongoose from 'mongoose';

// Create new supply chain record
export const create = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Check if user is authenticated
    if (!req.isAuthenticated || !req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      throw error;
    }

    // Add the authenticated user's ID and role to the request body
    req.body.createdBy = req.user.name;
    req.body.userRole = req.user.role;

    const { provinceId, tahun } = req.body;
    
    // Validate year is an integer
    if (!Number.isInteger(tahun)) {
      const error = new Error('Year must be an integer');
      error.statusCode = 400;
      throw error;
    }
    
    // Verify province exists and get its name
    const province = await Province.findById(provinceId);
    if (!province) {
      const error = new Error('Province not found');
      error.statusCode = 404;
      throw error;
    }
    
    // Check if data already exists for this province and year
    const existingData = await SupplyChain.findOne({ provinsi: province.name, tahun });
    
    if (existingData) {
      const error = new Error('Supply chain data already exists for this province and year');
      error.statusCode = 409;
      throw error;
    }

    // Set the province name from the found province object
    req.body.provinsi = province.name;
    // Store province ID as a reference
    req.body.provinceReference = provinceId;

    const supplyChain = await SupplyChain.create([req.body], { session });
    
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      data: {
        ...supplyChain[0]._doc,
        province: {
          id: province._id,
          name: province.name,
          code: province.code
        }
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    // Handle validation errors with a more friendly message
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // For custom errors with statusCode
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    // For other errors
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

// Get all supply chain records
export const findAll = asyncHandler(async (req, res) => {
  const supplyChains = await SupplyChain.find();
  res.status(200).json({
    success: true,
    count: supplyChains.length,
    data: supplyChains
  });
});

// Get a single supply chain record by ID
export const findOne = asyncHandler(async (req, res) => {
  const supplyChain = await SupplyChain.findById(req.params.id);
  
  if (!supplyChain) {
    return res.status(404).json({
      success: false,
      message: 'Supply chain record not found'
    });
  }
  
  res.status(200).json({
    success: true,
    data: supplyChain
  });
});

// Get supply chain records by year
export const findByYear = asyncHandler(async (req, res) => {
  const supplyChains = await SupplyChain.find({ tahun: req.params.tahun });
  
  res.status(200).json({
    success: true,
    count: supplyChains.length,
    data: supplyChains
  });
});

// Get supply chain records by province ID
export const findByProvince = asyncHandler(async (req, res) => {
  const provinceId = req.params.id;
  
  // Verify province exists
  const province = await Province.findById(provinceId);
  if (!province) {
    return res.status(404).json({
      success: false,
      message: 'Province not found'
    });
  }
  
  // Find supply chain data using province name from the found province
  const supplyChains = await SupplyChain.find({ provinsi: province.name });
  
  res.status(200).json({
    success: true,
    province: {
      id: province._id,
      name: province.name,
      code: province.code
    },
    count: supplyChains.length,
    data: supplyChains
  });
});

// Get supply chain records by condition
export const findByCondition = asyncHandler(async (req, res) => {
  const condition = req.params.kondisi.toLowerCase();
  let query = {};
  
  // Define different conditions based on the parameter
  if (condition === 'surplus') {
    query = { $expr: { $gt: ["$produksiBeras", "$konsumsiBeras"] } };
  } else if (condition === 'deficit') {
    query = { $expr: { $lt: ["$produksiBeras", "$konsumsiBeras"] } };
  }
//   } else if (condition === 'balanced') {
//     query = { $expr: { $eq: ["$produksiBeras", "$konsumsiBeras"] } };
//   }
  
  const supplyChains = await SupplyChain.find(query);
  
  res.status(200).json({
    success: true,
    count: supplyChains.length,
    data: supplyChains
  });
});

// Get statistics by year
export const getStatsByYear = asyncHandler(async (req, res) => {
  const year = req.params.tahun;
  
  // Aggregate query to get statistics
  const stats = await SupplyChain.aggregate([
    { $match: { tahun: parseInt(year) } },
    { $group: {
        _id: null,
        avgMpp: { $avg: "$mpp" },
        avgChainCount: { $avg: "$jumlahRantai" },
        totalProduction: { $sum: "$produksiBeras" },
        totalConsumption: { $sum: "$konsumsiBeras" },
        count: { $sum: 1 }
      }
    }
  ]);
  
  if (stats.length === 0) {
    return res.status(404).json({
      success: false,
      message: `No data found for year ${year}`
    });
  }
  
  res.status(200).json({
    success: true,
    data: stats[0]
  });
});

// Update a supply chain record
export const update = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Check if user is authenticated
    if (!req.isAuthenticated || !req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      throw error;
    }

    const { id } = req.params;
    
    // Find the record first to check permissions
    const existingData = await SupplyChain.findById(id);
    
    if (!existingData) {
      const error = new Error('Supply chain record not found');
      error.statusCode = 404;
      throw error;
    }
    
    // Handle province ID if provided
    if (req.body.provinceId) {
      const province = await Province.findById(req.body.provinceId);
      if (!province) {
        const error = new Error('Province not found');
        error.statusCode = 404;
        throw error;
      }
      
      // Prevent changing province
      if (province.name !== existingData.provinsi) {
        const error = new Error('Province cannot be modified');
        error.statusCode = 400;
        throw error;
      }
      
      // Remove provinceId from request body as we use provinsi internally
      delete req.body.provinceId;
    }
    
    // Prevent changing province and year which are unique identifiers
    if (req.body.provinsi && req.body.provinsi !== existingData.provinsi) {
      const error = new Error('Province cannot be modified');
      error.statusCode = 400;
      throw error;
    }
    
    if (req.body.tahun && req.body.tahun !== existingData.tahun) {
      const error = new Error('Year cannot be modified');
      error.statusCode = 400;
      throw error;
    }
    
    // Record who made the update
    const updateData = {
      ...req.body,
      updatedAt: new Date(),
      updatedBy: req.user.name
    };
    
    const supplyChain = await SupplyChain.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true, session }
    );
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({
      success: true,
      data: supplyChain
    });
    
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    // Handle validation errors with a more friendly message
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }
    
    // For custom errors with statusCode
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    
    // For other errors
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

// Delete a supply chain record
export const deleteSupplyChain = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Check if user is authenticated
    if (!req.isAuthenticated || !req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      throw error;
    }

    const { id } = req.params;
    
    const supplyChain = await SupplyChain.findById(id);
    
    if (!supplyChain) {
      const error = new Error('Supply chain record not found');
      error.statusCode = 404;
      throw error;
    }
    
    await supplyChain.deleteOne({ session });
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({
      success: true,
      message: 'Supply chain record deleted successfully',
      data: {}
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    // For custom errors with statusCode
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    
    // For other errors
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

/**
 * Bulk import supply chain data
 */
export const bulkImportSupplyChain = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Check if user is authenticated
    if (!req.isAuthenticated || !req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      throw error;
    }

    const { supplyChainData } = req.body;
    
    if (!supplyChainData || !Array.isArray(supplyChainData) || supplyChainData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid supplyChainData array is required'
      });
    }
    
    const result = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
      processedCount: 0
    };
    
    // Process each supply chain data entry
    for (const [index, data] of supplyChainData.entries()) {
      try {
        result.processedCount++;
        
        const { provinceId, tahun } = data;
        
        // Validate required fields
        if (!provinceId || !tahun) {
          throw new Error('Missing required fields: provinceId or tahun');
        }
        
        // Validate year is an integer
        if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2100) {
          throw new Error(`Invalid year: ${tahun}. Year must be an integer between 2000 and 2100`);
        }
        
        // Validate ObjectId format for provinceId
        if (!mongoose.Types.ObjectId.isValid(provinceId)) {
          throw new Error(`Invalid provinceId format: ${provinceId}`);
        }
        
        // Verify province exists and get its name
        const province = await Province.findById(provinceId);
        if (!province) {
          throw new Error(`Province not found with ID: ${provinceId}`);
        }
        
        // Check if data already exists for this province and year
        const existingData = await SupplyChain.findOne({ 
          provinsi: province.name, 
          tahun 
        });
        
        // Prepare the data to save
        const supplyChainEntry = {
          ...data,
          provinsi: province.name,
          provinceReference: provinceId,
          createdBy: req.user.name || req.user._id,
          userRole: req.user.role,
          createdAt: new Date()
        };
        
        // Remove provinceId from the entry as we use provinsi internally
        delete supplyChainEntry.provinceId;
        
        if (existingData) {
          // Update existing data
          const updateData = {
            ...supplyChainEntry,
            updatedAt: new Date(),
            updatedBy: req.user._id
          };
          
          await SupplyChain.findByIdAndUpdate(
            existingData._id,
            { $set: updateData },
            { new: true, runValidators: true, session }
          );
          
          result.updated++;
        } else {
          // Create new data
          await SupplyChain.create([supplyChainEntry], { session });
          result.created++;
        }
        
      } catch (error) {
        result.failed++;
        result.errors.push({
          index: index + 1,
          data: data,
          error: error.message
        });
        
        // Log the error for debugging
        console.error(`Error processing supply chain data at index ${index + 1}:`, error.message);
      }
    }
    
    await session.commitTransaction();
    session.endSession();
    
    const statusCode = result.failed > 0 ? 207 : 200; // 207 Multi-Status if there are failures
    
    return res.status(statusCode).json({
      success: result.failed === 0,
      message: `Bulk import completed. Created: ${result.created}, Updated: ${result.updated}, Failed: ${result.failed}`,
      result: {
        totalProcessed: result.processedCount,
        successful: result.created + result.updated,
        created: result.created,
        updated: result.updated,
        failed: result.failed,
        errors: result.errors
      }
    });
    
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error bulk importing supply chain data:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error during bulk import',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    // For custom errors with statusCode
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Error bulk importing supply chain data',
      error: error.message
    });
  }
});


export const validateBulkImportData = asyncHandler(async (req, res) => {
  try {
    const { supplyChainData } = req.body;
    
    if (!supplyChainData || !Array.isArray(supplyChainData)) {
      return res.status(400).json({
        success: false,
        message: 'supplyChainData must be an array'
      });
    }
    
    const validationResults = {
      totalEntries: supplyChainData.length,
      validEntries: 0,
      invalidEntries: 0,
      errors: []
    };
    
    // Required fields validation schema
    const requiredFields = ['provinceId', 'tahun'];
    
    for (const [index, data] of supplyChainData.entries()) {
      const entryErrors = [];
      
      // Check required fields
      requiredFields.forEach(field => {
        if (!data[field]) {
          entryErrors.push(`Missing required field: ${field}`);
        }
      });
      
      // Validate year
      if (data.tahun && (!Number.isInteger(data.tahun) || data.tahun < 2000 || data.tahun > 2100)) {
        entryErrors.push(`Invalid year: ${data.tahun}`);
      }
      
      // Validate provinceId format
      if (data.provinceId && !mongoose.Types.ObjectId.isValid(data.provinceId)) {
        entryErrors.push(`Invalid provinceId format: ${data.provinceId}`);
      }
      
      // Validate numeric fields if present
      const numericFields = ['mpp', 'jumlahRantai', 'produksiBeras', 'konsumsiBeras'];
      numericFields.forEach(field => {
        if (data[field] !== undefined && (typeof data[field] !== 'number' || data[field] < 0)) {
          entryErrors.push(`Invalid ${field}: ${data[field]}. Must be a non-negative number`);
        }
      });
      
      if (entryErrors.length === 0) {
        validationResults.validEntries++;
      } else {
        validationResults.invalidEntries++;
        validationResults.errors.push({
          index: index + 1,
          data: data,
          errors: entryErrors
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      message: 'Validation completed',
      validation: validationResults,
      readyForImport: validationResults.invalidEntries === 0
    });
    
  } catch (error) {
    console.error('Error validating bulk import data:', error);
    return res.status(500).json({
      success: false,
      message: 'Error validating bulk import data',
      error: error.message
    });
  }
});

// Get supply chain records by province ID and year
export const findByProvinceAndYear = asyncHandler(async (req, res) => {
  const { id: provinceId, tahun } = req.params;
  
  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(provinceId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid province ID format'
    });
  }
  
  // Validate year
  const yearInt = parseInt(tahun, 10);
  if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
    return res.status(400).json({
      success: false,
      message: 'Invalid year. Year must be between 2000 and 2100'
    });
  }
  
  // Verify province exists
  const province = await Province.findById(provinceId);
  if (!province) {
    return res.status(404).json({
      success: false,
      message: 'Province not found'
    });
  }
  
  // Find supply chain data using province name and year
  const supplyChain = await SupplyChain.findOne({ 
    provinsi: province.name,
    tahun: yearInt
  });
  
  if (!supplyChain) {
    return res.status(404).json({
      success: false,
      message: `No supply chain data found for ${province.name} in year ${yearInt}`,
      province: {
        id: province._id,
        name: province.name,
        code: province.code
      },
      year: yearInt
    });
  }
  
  res.status(200).json({
    success: true,
    province: {
      id: province._id,
      name: province.name,
      code: province.code
    },
    year: yearInt,
    data: supplyChain
  });
});
