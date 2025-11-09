import mongoose from 'mongoose';
import Clustering from '../models/clustering.model.js';
import Province from '../models/province.model.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Get all clustering data with pagination and filtering
 */
export const getAllClusteringData = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    sortBy = 'createdAt', 
    order = 'desc',
    tahun,
    tahunMin,
    tahunMax,
    provinsi,
    clusterId,
    clusterGroup,
    fields
  } = req.query;
  
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { [sortBy]: order === 'desc' ? -1 : 1 }
  };
  
  // Build filter query
  let filter = {};
  
  // Year filtering
  if (tahun) {
    filter.tahun = parseInt(tahun, 10);
  } else if (tahunMin || tahunMax) {
    filter.tahun = {};
    if (tahunMin) filter.tahun.$gte = parseInt(tahunMin, 10);
    if (tahunMax) filter.tahun.$lte = parseInt(tahunMax, 10);
  }
  
  // Province filtering
  if (provinsi) {
    filter.namaProvinsi = { $regex: provinsi, $options: 'i' };
  }
  
  // Cluster filtering
  if (clusterId !== undefined) {
    filter.clusterId = parseInt(clusterId, 10);
  }
  
  if (clusterGroup !== undefined) {
    filter.clusterGroup = parseInt(clusterGroup, 10);
  }
  
  // Field selection
  let projection = {};
  if (fields) {
    const selectedFields = fields.split(',').map(field => field.trim());
    selectedFields.forEach(field => {
      projection[field] = 1;
    });
    projection._id = 1;
    projection.namaProvinsi = 1;
    projection.tahun = 1;
  }
  
  const query = Clustering.find(filter, projection)
    .populate('provinceId', 'name code')
    .skip((options.page - 1) * options.limit)
    .limit(options.limit)
    .sort(options.sort);
  
  const clusteringData = await query.exec();
  const total = await Clustering.countDocuments(filter);
  
  res.status(200).json({
    success: true,
    data: clusteringData,
    filters: {
      applied: filter,
      selectedFields: fields ? fields.split(',') : 'all'
    },
    pagination: {
      total,
      page: options.page,
      limit: options.limit,
      pages: Math.ceil(total / options.limit)
    }
  });
});

/**
 * Get clustering data by ID
 */
export const getClusteringById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { fields } = req.query;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }
  
  let projection = {};
  if (fields) {
    const selectedFields = fields.split(',').map(field => field.trim());
    selectedFields.forEach(field => {
      projection[field] = 1;
    });
    projection._id = 1;
  }
  
  const clusteringData = await Clustering.findById(id, projection)
    .populate('provinceId', 'name code');
  
  if (!clusteringData) {
    return res.status(404).json({
      success: false,
      message: 'Clustering data not found'
    });
  }
  
  res.status(200).json({
    success: true,
    data: clusteringData
  });
});

/**
 * Get clustering data by province
 */
export const getClusteringByProvince = asyncHandler(async (req, res) => {
  const { id: provinceId } = req.params;
  const { year, fields, sortBy = 'tahun', order = 'desc' } = req.query;
  
  if (!mongoose.Types.ObjectId.isValid(provinceId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid province ID format'
    });
  }
  
  const province = await Province.findById(provinceId);
  if (!province) {
    return res.status(404).json({
      success: false,
      message: 'Province not found'
    });
  }
  
  let query = { provinceId: provinceId };
  
  if (year) {
    query.tahun = parseInt(year, 10);
  }
  
  let projection = {};
  if (fields) {
    const selectedFields = fields.split(',').map(field => field.trim());
    selectedFields.forEach(field => {
      projection[field] = 1;
    });
    projection._id = 1;
    projection.namaProvinsi = 1;
    projection.tahun = 1;
  }
  
  const sortOptions = { [sortBy]: order === 'desc' ? -1 : 1 };
  const clusteringData = await Clustering.find(query, projection)
    .populate('provinceId', 'name code')
    .sort(sortOptions);
  
  return res.status(200).json({
    success: true,
    province: {
      id: province._id,
      name: province.name,
      code: province.code
    },
    count: clusteringData.length,
    data: clusteringData
  });
});

/**
 * Get clustering data by year
 */
export const getClusteringByYear = asyncHandler(async (req, res) => {
  const { year } = req.params;
  const { fields, sortBy = 'namaProvinsi', order = 'asc' } = req.query;
  const yearInt = parseInt(year, 10);
  
  if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2045) {
    return res.status(400).json({
      success: false,
      message: 'Invalid year. Year must be between 2000 and 2045'
    });
  }
  
  let projection = {};
  if (fields) {
    const selectedFields = fields.split(',').map(field => field.trim());
    selectedFields.forEach(field => {
      projection[field] = 1;
    });
    projection._id = 1;
    projection.namaProvinsi = 1;
    projection.tahun = 1;
  }
  
  const sortOptions = { [sortBy]: order === 'desc' ? -1 : 1 };
  const clusteringData = await Clustering.find({ tahun: yearInt }, projection)
    .populate('provinceId', 'name code')
    .sort(sortOptions);
  
  res.status(200).json({
    success: true,
    year: yearInt,
    count: clusteringData.length,
    data: clusteringData
  });
});

/**
 * Get clustering data by cluster ID
 */
export const getClusteringByClusterId = asyncHandler(async (req, res) => {
  const { clusterId } = req.params;
  const { year, fields, sortBy = 'namaProvinsi', order = 'asc' } = req.query;
  
  const clusterIdInt = parseInt(clusterId, 10);
  if (isNaN(clusterIdInt) || clusterIdInt < -1) {
    return res.status(400).json({
      success: false,
      message: 'Invalid cluster ID. Must be an integer >= -1 (-1 for outliers)'
    });
  }
  
  let query = { cluster_id: clusterIdInt };
  if (year) {
    query.tahun = parseInt(year, 10);
  }
  
  let projection = {};
  if (fields) {
    const selectedFields = fields.split(',').map(field => field.trim());
    selectedFields.forEach(field => {
      projection[field] = 1;
    });
    projection._id = 1;
    projection.namaProvinsi = 1;
    projection.tahun = 1;
  }
  
  const sortOptions = { [sortBy]: order === 'desc' ? -1 : 1 };
  const clusteringData = await Clustering.find(query, projection)
    .populate('provinceId', 'name code')
    .sort(sortOptions);
  
  const clusterType = clusterIdInt === -1 ? 'outlier' : 'cluster';
  const clusterLabel = clusterIdInt === -1 ? 'Outlier' : `Cluster ${clusterIdInt}`;
  
  res.status(200).json({
    success: true,
    clusterId: clusterIdInt,
    clusterType,
    clusterLabel,
    year: year ? parseInt(year, 10) : 'all',
    count: clusteringData.length,
    data: clusteringData
  });
});

/**
 * Get cluster statistics by year
 */
export const getClusterStatsByYear = asyncHandler(async (req, res) => {
  const { year } = req.params;
  const yearInt = parseInt(year, 10);
  
  if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2045) {
    return res.status(400).json({
      success: false,
      message: 'Invalid year. Year must be between 2000 and 2045'
    });
  }
  
  const stats = await Clustering.aggregate([
    { $match: { tahun: yearInt } },
    {
      $group: {
        _id: '$cluster_id',
        count: { $sum: 1 },
        provinces: { $push: '$namaProvinsi' },
        cluster_summary: { $first: '$cluster_summary' },
        isOutlier: { $first: { $eq: ['$cluster_id', -1] } }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  // Separate outliers from clusters
  const clusters = stats.filter(s => s._id !== -1);
  const outliers = stats.find(s => s._id === -1);
  
  res.status(200).json({
    success: true,
    year: yearInt,
    totalClusters: clusters.length,
    totalOutliers: outliers ? outliers.count : 0,
    clusterStatistics: clusters.map(cluster => ({
      ...cluster,
      clusterLabel: `Cluster ${cluster._id}`,
      type: 'cluster'
    })),
    outlierStatistics: outliers ? {
      ...outliers,
      clusterLabel: 'Outlier',
      type: 'outlier'
    } : null
  });
});

/**
 * Get only outliers by year
 */
export const getOutliersByYear = asyncHandler(async (req, res) => {
  const { year } = req.params;
  const { fields, sortBy = 'namaProvinsi', order = 'asc' } = req.query;
  const yearInt = parseInt(year, 10);
  
  if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2045) {
    return res.status(400).json({
      success: false,
      message: 'Invalid year. Year must be between 2000 and 2045'
    });
  }
  
  let projection = {};
  if (fields) {
    const selectedFields = fields.split(',').map(field => field.trim());
    selectedFields.forEach(field => {
      projection[field] = 1;
    });
    projection._id = 1;
    projection.namaProvinsi = 1;
    projection.tahun = 1;
  }
  
  const sortOptions = { [sortBy]: order === 'desc' ? -1 : 1 };
  const outliers = await Clustering.find({ 
    tahun: yearInt, 
    cluster_id: -1 
  }, projection)
    .populate('provinceId', 'name code')
    .sort(sortOptions);
  
  res.status(200).json({
    success: true,
    year: yearInt,
    type: 'outliers',
    count: outliers.length,
    data: outliers
  });
});

/**
 * Create new clustering data
 */
export const createClusteringData = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    if (!req.isAuthenticated || !req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      throw error;
    }

    const { provinceId, tahun, clusterId } = req.body;
    
    if (!Number.isInteger(tahun)) {
      const error = new Error('Year must be an integer');
      error.statusCode = 400;
      throw error;
    }
    
    const province = await Province.findById(provinceId);
    if (!province) {
      const error = new Error('Province not found');
      error.statusCode = 404;
      throw error;
    }
    
    // Check if data already exists
    const existingData = await Clustering.findOne({ 
      provinceId: provinceId, 
      tahun: tahun 
    });
    
    if (existingData) {
      const error = new Error('Clustering data already exists for this province and year');
      error.statusCode = 409;
      throw error;
    }
    
    let newData = {
      ...req.body,
      provinceId: provinceId,
      namaProvinsi: province.name,
      kodeProvinsi: province.code,
      createdBy: req.user.name,
      userRole: req.user.role
    };
    
    const newClusteringData = await Clustering.create([newData], { session });
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(201).json({
      success: true,
      message: 'Clustering data created successfully',
      data: {
        ...newClusteringData[0]._doc,
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
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }
    
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

/**
 * Update clustering data
 */
export const updateClusteringData = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    if (!req.isAuthenticated || !req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      throw error;
    }

    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error('Invalid ID format');
      error.statusCode = 400;
      throw error;
    }
    
    const existingData = await Clustering.findById(id);
    
    if (!existingData) {
      const error = new Error('Clustering data not found');
      error.statusCode = 404;
      throw error;
    }
    
    // Prevent changing province and year
    if (req.body.provinceId && req.body.provinceId !== existingData.provinceId.toString()) {
      const error = new Error('Province cannot be modified');
      error.statusCode = 400;
      throw error;
    }
    
    if (req.body.tahun && req.body.tahun !== existingData.tahun) {
      const error = new Error('Year cannot be modified');
      error.statusCode = 400;
      throw error;
    }
    
    const updateData = {
      ...req.body,
      updatedAt: new Date(),
      updatedBy: req.user._id
    };
    
    const updatedData = await Clustering.findByIdAndUpdate(
      id, 
      { $set: updateData },
      { new: true, runValidators: true, session }
    ).populate('provinceId', 'name code');
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({
      success: true,
      message: 'Clustering data updated successfully',
      data: updatedData
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

/**
 * Delete clustering data
 */
export const deleteClusteringData = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    if (!req.isAuthenticated || !req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      throw error;
    }

    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error('Invalid ID format');
      error.statusCode = 400;
      throw error;
    }
    
    const deletedData = await Clustering.findByIdAndDelete(id).session(session);
    
    if (!deletedData) {
      const error = new Error('Clustering data not found');
      error.statusCode = 404;
      throw error;
    }
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({
      success: true,
      message: 'Clustering data deleted successfully'
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

/**
 * Bulk import clustering data
 */
export const bulkImportClustering = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    if (!req.isAuthenticated || !req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      throw error;
    }

    const { clusteringData } = req.body;
    
    if (!clusteringData || !Array.isArray(clusteringData) || clusteringData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid clusteringData array is required'
      });
    }
    
    const result = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
      processedCount: 0,
      outliers: 0,
      clusters: 0
    };
    
    // Process each clustering data entry
    for (const [index, data] of clusteringData.entries()) {
      try {
        result.processedCount++;
        
        const { provinceId, tahun, cluster_id, cluster_group, cluster_summary } = data;
        
        // Validate required fields
        if (!provinceId || !tahun || cluster_id === undefined || !cluster_group || !cluster_summary) {
          throw new Error('Missing required fields: provinceId, tahun, cluster_id, cluster_group, or cluster_summary');
        }
        
        if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2045) {
          throw new Error(`Invalid year: ${tahun}. Year must be an integer between 2000 and 2045`);
        }
        
        if (!Number.isInteger(cluster_id) || cluster_id < -1) {
          throw new Error(`Invalid cluster_id: ${cluster_id}. Must be an integer >= -1`);
        }
        
        if (!mongoose.Types.ObjectId.isValid(provinceId)) {
          throw new Error(`Invalid provinceId format: ${provinceId}`);
        }
        
        const province = await Province.findById(provinceId);
        if (!province) {
          throw new Error(`Province not found with ID: ${provinceId}`);
        }
        
        // Validate cluster_summary structure
        const requiredSummaryFields = ['indikator_umum_ketahanan_pangan', 'ketersediaan', 'aksesibilitas', 'pemanfaatan', 'stabilitas'];
        for (const field of requiredSummaryFields) {
          if (!cluster_summary[field] || !cluster_summary[field].status || cluster_summary[field].rata_rata_skor_standar === undefined) {
            throw new Error(`Invalid cluster_summary.${field}: missing status or rata_rata_skor_standar`);
          }
        }
        
        // Check if data already exists
        const existingData = await Clustering.findOne({ 
          provinceId: provinceId, 
          tahun 
        });
        
        const clusteringEntry = {
          provinceId: provinceId,
          tahun,
          cluster_id,
          cluster_group,
          cluster_summary,
          namaProvinsi: province.name,
          kodeProvinsi: province.code,
          isOutlier: cluster_id === -1,
          clusterLabel: cluster_id === -1 ? 'Outlier' : `Cluster ${cluster_id}`,
          createdBy: req.user.name || req.user._id,
          userRole: req.user.role,
          createdAt: new Date()
        };
        
        // Count outliers vs clusters
        if (cluster_id === -1) {
          result.outliers++;
        } else {
          result.clusters++;
        }
        
        if (existingData) {
          const updateData = {
            ...clusteringEntry,
            updatedAt: new Date(),
            updatedBy: req.user._id
          };
          
          await Clustering.findByIdAndUpdate(
            existingData._id,
            { $set: updateData },
            { new: true, runValidators: true, session }
          );
          
          result.updated++;
        } else {
          await Clustering.create([clusteringEntry], { session });
          result.created++;
        }
        
      } catch (error) {
        result.failed++;
        result.errors.push({
          index: index + 1,
          data: data,
          error: error.message
        });
        
        console.error(`Error processing clustering data at index ${index + 1}:`, error.message);
      }
    }
    
    await session.commitTransaction();
    session.endSession();
    
    const statusCode = result.failed > 0 ? 207 : 200;
    
    return res.status(statusCode).json({
      success: result.failed === 0,
      message: `Bulk import completed. Created: ${result.created}, Updated: ${result.updated}, Failed: ${result.failed}`,
      result: {
        totalProcessed: result.processedCount,
        successful: result.created + result.updated,
        created: result.created,
        updated: result.updated,
        failed: result.failed,
        outliers: result.outliers,
        clusters: result.clusters,
        errors: result.errors
      }
    });
    
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error bulk importing clustering data:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error during bulk import',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Error bulk importing clustering data',
      error: error.message
    });
  }
});

/**
 * Validate bulk import data format
 */
export const validateBulkImportData = asyncHandler(async (req, res) => {
  const { clusteringData } = req.body;
  
  if (!clusteringData || !Array.isArray(clusteringData)) {
    return res.status(400).json({
      success: false,
      message: 'clusteringData must be an array'
    });
  }
  
  const validationResults = {
    totalEntries: clusteringData.length,
    validEntries: 0,
    invalidEntries: 0,
    outliers: 0,
    clusters: 0,
    errors: []
  };
  
  const requiredFields = ['provinceId', 'tahun', 'cluster_id', 'cluster_group', 'cluster_summary'];
  
  for (const [index, data] of clusteringData.entries()) {
    const entryErrors = [];
    
    // Check required fields
    requiredFields.forEach(field => {
      if (data[field] === undefined || data[field] === null) {
        entryErrors.push(`Missing required field: ${field}`);
      }
    });
    
    // Validate year
    if (data.tahun && (!Number.isInteger(data.tahun) || data.tahun < 2000 || data.tahun > 2045)) {
      entryErrors.push(`Invalid year: ${data.tahun}`);
    }
    
    // Validate cluster_id (allow -1 for outliers)
    if (data.cluster_id !== undefined && (!Number.isInteger(data.cluster_id) || data.cluster_id < -1)) {
      entryErrors.push(`Invalid cluster_id: ${data.cluster_id}. Must be an integer >= -1`);
    }
    
    // Validate provinceId format
    if (data.provinceId && !mongoose.Types.ObjectId.isValid(data.provinceId)) {
      entryErrors.push(`Invalid provinceId format: ${data.provinceId}`);
    }
    
    // Validate cluster_summary structure
    if (data.cluster_summary) {
      const requiredSummaryFields = ['indikator_umum_ketahanan_pangan', 'ketersediaan', 'aksesibilitas', 'pemanfaatan', 'stabilitas'];
      requiredSummaryFields.forEach(field => {
        if (!data.cluster_summary[field] || 
            !data.cluster_summary[field].status || 
            data.cluster_summary[field].rata_rata_skor_standar === undefined) {
          entryErrors.push(`Invalid cluster_summary.${field}: missing status or rata_rata_skor_standar`);
        }
      });
    }
    
    if (entryErrors.length === 0) {
      validationResults.validEntries++;
      // Count outliers vs clusters
      if (data.cluster_id === -1) {
        validationResults.outliers++;
      } else {
        validationResults.clusters++;
      }
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
});
