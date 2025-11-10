import mongoose from 'mongoose';
import FoodSecurity from '../models/foodsecurity.model.js';
import Province from '../models/province.model.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Get all food security data with pagination and filtering
 */
export const getAllFoodSecurityData = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    sortBy = 'createdAt', 
    order = 'desc',
    tahun,
    tahunMin,
    tahunMax,
    provinsi,
    fields,
    dependentVar,
    independentVars,
    all // Parameter baru untuk mengambil semua data
  } = req.query;
  
  // Jika parameter 'all' = true, ambil semua data tanpa pagination
  const getAllData = all === 'true';
  
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
    filter.provinsi = { $regex: provinsi, $options: 'i' };
  }
  
  // Variable range filtering for dependent variable
  if (dependentVar) {
    const { min, max } = JSON.parse(dependentVar);
    if (min !== undefined || max !== undefined) {
      filter['dependent_variable.prevalence_of_undernourishment'] = {};
      if (min !== undefined) filter['dependent_variable.prevalence_of_undernourishment'].$gte = parseFloat(min);
      if (max !== undefined) filter['dependent_variable.prevalence_of_undernourishment'].$lte = parseFloat(max);
    }
  }
  
  // Variable range filtering for independent variables
  if (independentVars) {
    const indepFilters = JSON.parse(independentVars);
    Object.keys(indepFilters).forEach(key => {
      const { min, max } = indepFilters[key];
      if (min !== undefined || max !== undefined) {
        filter[`independent_variables.${key}`] = {};
        if (min !== undefined) filter[`independent_variables.${key}`].$gte = parseFloat(min);
        if (max !== undefined) filter[`independent_variables.${key}`].$lte = parseFloat(max);
      }
    });
  }
  
  // Field selection
  let projection = {};
  if (fields) {
    const selectedFields = fields.split(',').map(field => field.trim());
    selectedFields.forEach(field => {
      projection[field] = 1;
    });
    // Always include _id, provinsi, and tahun for reference
    projection._id = 1;
    projection.provinsi = 1;
    projection.tahun = 1;
  }
  
  const sortOptions = { [sortBy]: order === 'desc' ? -1 : 1 };
  
  let query = FoodSecurity.find(filter, projection).sort(sortOptions);
  
  // Hanya apply pagination jika tidak mengambil semua data
  if (!getAllData) {
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    };
    
    query = query
      .skip((options.page - 1) * options.limit)
      .limit(options.limit);
  }
  
  const foodSecurityData = await query.exec();
  const total = await FoodSecurity.countDocuments(filter);
  
  const response = {
    success: true,
    data: foodSecurityData,
    filters: {
      applied: filter,
      selectedFields: fields ? fields.split(',') : 'all'
    },
    total: total
  };
  
  // Hanya tambahkan pagination info jika tidak mengambil semua data
  if (!getAllData) {
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    };
    
    response.pagination = {
      total,
      page: options.page,
      limit: options.limit,
      pages: Math.ceil(total / options.limit)
    };
  }
  
  res.status(200).json(response);
});

/**
 * Get food security data by ID
 */
export const getFoodSecurityById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { fields } = req.query;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }
  
  // Field selection
  let projection = {};
  if (fields) {
    const selectedFields = fields.split(',').map(field => field.trim());
    selectedFields.forEach(field => {
      projection[field] = 1;
    });
    projection._id = 1;
  }
  
  const foodSecurityData = await FoodSecurity.findById(id, projection);
  
  if (!foodSecurityData) {
    return res.status(404).json({
      success: false,
      message: 'Food security data not found'
    });
  }
  
  res.status(200).json({
    success: true,
    data: foodSecurityData
  });
});

/**
 * Get food security data by province
 */
export const getFoodSecurityByProvince = asyncHandler(async (req, res) => {
  const { id: provinceId } = req.params;
  const { year, fields, sortBy = 'tahun', order = 'desc' } = req.query;
  
  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(provinceId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid province ID format'
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
  
  // Build query using provinsi field (which stores province name)
  let query = { provinsi: province.name };
  
  if (year) {
    query.tahun = parseInt(year, 10);
  }
  
  // Field selection
  let projection = {};
  if (fields) {
    const selectedFields = fields.split(',').map(field => field.trim());
    selectedFields.forEach(field => {
      projection[field] = 1;
    });
    projection._id = 1;
    projection.provinsi = 1;
    projection.tahun = 1;
  }
  
  const sortOptions = { [sortBy]: order === 'desc' ? -1 : 1 };
  const foodSecurityData = await FoodSecurity.find(query, projection).sort(sortOptions);
  
  return res.status(200).json({
    success: true,
    province: {
      id: province._id,
      name: province.name,
      code: province.code
    },
    count: foodSecurityData.length,
    data: foodSecurityData
  });
});

/**
 * Get food security data by year
 */
export const getFoodSecurityByYear = asyncHandler(async (req, res) => {
  const { year } = req.params;
  const { fields, sortBy = 'provinsi', order = 'asc' } = req.query;
  const yearInt = parseInt(year, 10);
  
  if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
    return res.status(400).json({
      success: false,
      message: 'Invalid year. Year must be between 2000 and 2100'
    });
  }
  
  // Field selection
  let projection = {};
  if (fields) {
    const selectedFields = fields.split(',').map(field => field.trim());
    selectedFields.forEach(field => {
      projection[field] = 1;
    });
    projection._id = 1;
    projection.provinsi = 1;
    projection.tahun = 1;
  }
  
  const sortOptions = { [sortBy]: order === 'desc' ? -1 : 1 };
  const foodSecurityData = await FoodSecurity.find({ tahun: yearInt }, projection).sort(sortOptions);
  
  res.status(200).json({
    success: true,
    year: yearInt,
    count: foodSecurityData.length,
    data: foodSecurityData
  });
});

/**
 * Get food security data by province and year (specific combination)
 */
export const getFoodSecurityByProvinceAndYear = asyncHandler(async (req, res) => {
  const { id: provinceId, year } = req.params;
  const { fields } = req.query;
  
  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(provinceId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid province ID format'
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
  
  // Verify province exists
  const province = await Province.findById(provinceId);
  if (!province) {
    return res.status(404).json({
      success: false,
      message: 'Province not found'
    });
  }
  
  // Build query using provinsi field and year
  const query = { 
    provinsi: province.name,
    tahun: yearInt
  };
  
  // Field selection
  let projection = {};
  if (fields) {
    const selectedFields = fields.split(',').map(field => field.trim());
    selectedFields.forEach(field => {
      projection[field] = 1;
    });
    projection._id = 1;
    projection.provinsi = 1;
    projection.tahun = 1;
  }
  
  const foodSecurityData = await FoodSecurity.findOne(query, projection);
  
  if (!foodSecurityData) {
    return res.status(404).json({
      success: false,
      message: `No food security data found for ${province.name} in year ${yearInt}`,
      province: {
        id: province._id,
        name: province.name,
        code: province.code
      },
      year: yearInt
    });
  }
  
  return res.status(200).json({
    success: true,
    province: {
      id: province._id,
      name: province.name,
      code: province.code
    },
    year: yearInt,
    data: foodSecurityData
  });
});

/**
 * Get average food security index by year
 */
export const getAverageFoodSecurityByYear = asyncHandler(async (req, res) => {
  const { year } = req.params;
  const yearInt = parseInt(year, 10);
  
  if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
    return res.status(400).json({
      success: false,
      message: 'Invalid year. Year must be between 2000 and 2100'
    });
  }
  
  const result = await FoodSecurity.aggregate([
    { 
      $match: { tahun: yearInt } 
    },
    { 
      $group: { 
        _id: null,
        averageIndex: { $avg: '$dependent_variable.prevalence_of_undernourishment' },
        minIndex: { $min: '$dependent_variable.prevalence_of_undernourishment' },
        maxIndex: { $max: '$dependent_variable.prevalence_of_undernourishment' },
        count: { $sum: 1 }
      } 
    }
  ]);
  
  const stats = result.length > 0 ? result[0] : {
    averageIndex: 0,
    minIndex: 0,
    maxIndex: 0,
    count: 0
  };
  
  res.status(200).json({
    success: true,
    year: yearInt,
    statistics: {
      average: stats.averageIndex,
      minimum: stats.minIndex,
      maximum: stats.maxIndex,
      range: stats.maxIndex - stats.minIndex
    },
    provincesCount: stats.count
  });
});

/**
 * Get food security trend for a province over years
 */
export const getFoodSecurityTrend = asyncHandler(async (req, res) => {
  const { id: provinceId } = req.params;
  
  // Verify province exists
  const province = await Province.findById(provinceId);
  if (!province) {
    return res.status(404).json({
      success: false,
      message: 'Province not found'
    });
  }
  
  const trend = await FoodSecurity.find(
    { provinsi: province.name },
    'tahun dependent_variable.prevalence_of_undernourishment'
  ).sort({ tahun: 1 });
  
  if (trend.length === 0) {
    return res.status(200).json({
      success: true,
      message: `No historical data found for province: ${province.name}`,
      province: {
        id: province._id,
        name: province.name,
        code: province.code
      },
      data: []
    });
  }
  
  const formattedTrend = trend.map(item => ({
    year: item.tahun,
    index: item.dependent_variable.prevalence_of_undernourishment
  }));
  
  // Calculate change from previous year
  for (let i = 1; i < formattedTrend.length; i++) {
    formattedTrend[i].change = formattedTrend[i].index - formattedTrend[i-1].index;
    formattedTrend[i].changePercentage = formattedTrend[i-1].index !== 0 ? 
      ((formattedTrend[i].index - formattedTrend[i-1].index) / formattedTrend[i-1].index * 100).toFixed(2) : 
      'N/A';
  }
  
  res.status(200).json({
    success: true,
    province: {
      id: province._id,
      name: province.name,
      code: province.code
    },
    yearRange: {
      start: formattedTrend[0].year,
      end: formattedTrend[formattedTrend.length - 1].year
    },
    data: formattedTrend
  });
});

/**
 * Get provinces ranked by food security index for a year
 */
export const getFoodSecurityRanking = asyncHandler(async (req, res) => {
  const { year } = req.params;
  const { limit } = req.query;
  const yearInt = parseInt(year, 10);
  
  if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
    return res.status(400).json({
      success: false,
      message: 'Invalid year. Year must be between 2000 and 2100'
    });
  }
  
  let query = FoodSecurity.find(
    { tahun: yearInt },
    'provinsi dependent_variable.prevalence_of_undernourishment'
  ).sort({ 'dependent_variable.prevalence_of_undernourishment': 1 }); // 1 = ascending (lower is better for undernourishment)
  
  if (limit) {
    query = query.limit(parseInt(limit, 10));
  }
  
  const ranking = await query.exec();
  
  if (ranking.length === 0) {
    return res.status(200).json({
      success: true,
      message: `No food security data found for year: ${yearInt}`,
      year: yearInt,
      ranking: []
    });
  }
  
  const formattedRanking = ranking.map((item, index) => ({
    rank: index + 1,
    province: item.provinsi,
    index: item.dependent_variable.prevalence_of_undernourishment,
    status: item.dependent_variable.prevalence_of_undernourishment < 5 ? 'Very Low' :
            item.dependent_variable.prevalence_of_undernourishment < 15 ? 'Low' :
            item.dependent_variable.prevalence_of_undernourishment < 25 ? 'Moderate' :
            item.dependent_variable.prevalence_of_undernourishment < 35 ? 'High' : 'Very High'
  }));
  
  res.status(200).json({
    success: true,
    year: yearInt,
    totalProvinces: formattedRanking.length,
    ranking: formattedRanking
  });
});

/**
 * Get food security statistics by category (placeholder)
 */
export const getFoodSecurityStatsByCategory = asyncHandler(async (req, res) => {
  return res.status(501).json({
    success: false,
    message: 'Category functionality not implemented'
  });
});

/**
 * Get provinces by food security category (placeholder)
 */
export const getProvincesByCategory = asyncHandler(async (req, res) => {
  return res.status(501).json({
    success: false,
    message: 'Category functionality not implemented'
  });
});

/**
 * Create new food security data
 */
export const createFoodSecurityData = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Check if user is authenticated
    if (!req.isAuthenticated || !req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      throw error;
    }

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
    const existingData = await FoodSecurity.findOne({ provinsi: province.name, tahun });
    
    if (existingData) {
      const error = new Error('Food security data already exists for this province and year');
      error.statusCode = 409;
      throw error;
    }
    
    // Add default values for required fields based on the model structure
    const defaultData = {
      independent_variables: {
        persentase_nilai_perdagangan_domestik: 0,
        indeks_harga_implisit: 0,
        koefisien_gini: 0,
        indeks_pembangunan_manusia: 0,
        kepadatan_penduduk: 0,
        ketersediaan_infrastruktur_jalan: 0,
        indeks_kemahalan_konstruksi: 0,
        indeks_demokrasi_indonesia: 0
      }
    };
    
    // Merge user data with default values for missing required fields
    let newData = {
      ...defaultData,
      ...req.body,
      // Use province name from the found province object
      provinsi: province.name,
      // Store province ID as a reference (can be used for future lookups)
      provinceReference: provinceId,
      independent_variables: {
        ...defaultData.independent_variables,
        ...(req.body.independent_variables || {})
      },
      createdBy: req.user.name,
      userRole: req.user.role
    };
    
    const newFoodSecurityData = await FoodSecurity.create([newData], { session });
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(201).json({
      success: true,
      message: 'Food security data created successfully',
      data: {
        ...newFoodSecurityData[0]._doc,
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

    return res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

/**
 * Update food security data
 */
export const updateFoodSecurityData = asyncHandler(async (req, res) => {
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
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error('Invalid ID format');
      error.statusCode = 400;
      throw error;
    }
    
    // Find the record first to check permissions
    const existingData = await FoodSecurity.findById(id);
    
    if (!existingData) {
      const error = new Error('Food security data not found');
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
      updatedBy: req.user._id
    };
    
    const updatedData = await FoodSecurity.findByIdAndUpdate(
      id, 
      { $set: updateData },
      { new: true, runValidators: true, session }
    );
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({
      success: true,
      message: 'Food security data updated successfully',
      data: updatedData
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
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
      message: 'Server Error',
      error: error.message
    });
  }
});

/**
 * Delete food security data
 */
export const deleteFoodSecurityData = asyncHandler(async (req, res) => {
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
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error('Invalid ID format');
      error.statusCode = 400;
      throw error;
    }
    
    const deletedData = await FoodSecurity.findByIdAndDelete(id).session(session);
    
    if (!deletedData) {
      const error = new Error('Food security data not found');
      error.statusCode = 404;
      throw error;
    }
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({
      success: true,
      message: 'Food security data deleted successfully'
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

    return res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
});

/**
 * Bulk import food security data
 */
export const bulkImportFoodSecurity = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Check if user is authenticated
    if (!req.isAuthenticated || !req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      throw error;
    }

    const { foodSecurityData } = req.body;
    
    if (!foodSecurityData || !Array.isArray(foodSecurityData) || foodSecurityData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid foodSecurityData array is required'
      });
    }
    
    const result = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
      processedCount: 0
    };
    
    // Default values for required independent variables matching model schema
    const defaultIndependentVars = {
      persentase_nilai_perdagangan_domestik: 0,
      indeks_harga_implisit: 0,
      koefisien_gini: 0,
      indeks_pembangunan_manusia: 0,
      kepadatan_penduduk: 0,
      ketersediaan_infrastruktur_jalan: 0,
      indeks_kemahalan_konstruksi: 0,
      indeks_demokrasi_indonesia: 0
    };
    
    // Process each food security data entry
    for (const [index, data] of foodSecurityData.entries()) {
      try {
        result.processedCount++;
        
        const { provinceId, tahun, dependent_variable, independent_variables } = data;
        
        // Validate required fields
        if (!provinceId || !tahun || !dependent_variable?.prevalence_of_undernourishment) {
          throw new Error('Missing required fields: provinceId, tahun, or dependent_variable.prevalence_of_undernourishment');
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
        const existingData = await FoodSecurity.findOne({ 
          provinsi: province.name, 
          tahun 
        });
        
        // Prepare the data to save
        const foodSecurityEntry = {
          provinsi: province.name,
          tahun,
          provinceReference: provinceId,
          dependent_variable: {
            prevalence_of_undernourishment: dependent_variable.prevalence_of_undernourishment
          },
          independent_variables: {
            ...defaultIndependentVars,
            ...(independent_variables || {})
          },
          createdBy: req.user.name || req.user._id,
          userRole: req.user.role,
          createdAt: new Date()
        };
        
        if (existingData) {
          // Update existing data
          const updateData = {
            ...foodSecurityEntry,
            updatedAt: new Date(),
            updatedBy: req.user._id
          };
          
          await FoodSecurity.findByIdAndUpdate(
            existingData._id,
            { $set: updateData },
            { new: true, runValidators: true, session }
          );
          
          result.updated++;
        } else {
          // Create new data
          await FoodSecurity.create([foodSecurityEntry], { session });
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
        console.error(`Error processing food security data at index ${index + 1}:`, error.message);
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
    
    console.error('Error bulk importing food security data:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error during bulk import',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Error bulk importing food security data',
      error: error.message
    });
  }
});

/**
 * Validate bulk import data format
 */
export const validateBulkImportData = asyncHandler(async (req, res) => {
  const { foodSecurityData } = req.body;
  
  if (!foodSecurityData || !Array.isArray(foodSecurityData)) {
    return res.status(400).json({
      success: false,
      message: 'foodSecurityData must be an array'
    });
  }
  
  const validationResults = {
    totalEntries: foodSecurityData.length,
    validEntries: 0,
    invalidEntries: 0,
    errors: []
  };
  
  // Required fields validation schema
  const requiredFields = ['provinceId', 'tahun'];
  const requiredDependentVar = 'dependent_variable.prevalence_of_undernourishment';
  
  for (const [index, data] of foodSecurityData.entries()) {
    const entryErrors = [];
    
    // Check required fields
    requiredFields.forEach(field => {
      if (!data[field]) {
        entryErrors.push(`Missing required field: ${field}`);
      }
    });
    
    // Check dependent variable
    if (!data.dependent_variable?.prevalence_of_undernourishment) {
      entryErrors.push(`Missing required field: ${requiredDependentVar}`);
    }
    
    // Validate year
    if (data.tahun && (!Number.isInteger(data.tahun) || data.tahun < 2000 || data.tahun > 2100)) {
      entryErrors.push(`Invalid year: ${data.tahun}`);
    }
    
    // Validate provinceId format
    if (data.provinceId && !mongoose.Types.ObjectId.isValid(data.provinceId)) {
      entryErrors.push(`Invalid provinceId format: ${data.provinceId}`);
    }
    
    // Validate food security index range (assuming 0-100 scale)
    if (data.dependent_variable?.prevalence_of_undernourishment !== undefined) {
      const index = data.dependent_variable.prevalence_of_undernourishment;
      if (typeof index !== 'number' || index < 0 || index > 100) {
        entryErrors.push(`Invalid food security index: ${index}. Must be a number between 0 and 100`);
      }
    }
    
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
});

/**
 * Update food security categories (placeholder)
 */
export const updateFoodSecurityCategories = asyncHandler(async (req, res) => {
  return res.status(501).json({
    success: false,
    message: 'Category functionality not implemented'
  });
});
