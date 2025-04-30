import SupplyChain from '../models/supplychain.model.js';
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

    const { provinsi, tahun } = req.body;
    
    // Validate year is an integer
    if (!Number.isInteger(tahun)) {
      const error = new Error('Year must be an integer');
      error.statusCode = 400;
      throw error;
    }
    
    // Check if data already exists for this province and year
    const existingData = await SupplyChain.findOne({ provinsi, tahun });
    
    if (existingData) {
      const error = new Error('Supply chain data already exists for this province and year');
      error.statusCode = 409;
      throw error;
    }

    const supplyChain = await SupplyChain.create([req.body], { session });
    
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      data: supplyChain[0]
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

// Get supply chain records by province
export const findByProvince = asyncHandler(async (req, res) => {
  const supplyChains = await SupplyChain.find({ provinsi: req.params.provinsi });
  
  res.status(200).json({
    success: true,
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
