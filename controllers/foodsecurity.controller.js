import mongoose from 'mongoose';
import FoodSecurity from '../models/foodsecurity.model.js';
import Province from '../models/province.model.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Get all food security data with pagination
 */
export const getAllFoodSecurityData = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc' } = req.query;
  
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { [sortBy]: order === 'desc' ? -1 : 1 }
  };
  
  const foodSecurityData = await FoodSecurity.find()
    .skip((options.page - 1) * options.limit)
    .limit(options.limit)
    .sort(options.sort);
  
  const total = await FoodSecurity.countDocuments();
  
  res.status(200).json({
    success: true,
    data: foodSecurityData,
    pagination: {
      total,
      page: options.page,
      limit: options.limit,
      pages: Math.ceil(total / options.limit)
    }
  });
});

/**
 * Get food security data by ID
 */
export const getFoodSecurityById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }
  
  const foodSecurityData = await FoodSecurity.findById(id);
  
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
  const { year } = req.query;
  
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
  
  const foodSecurityData = await FoodSecurity.find(query).sort({ tahun: -1 });
  
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
  const yearInt = parseInt(year, 10);
  
  if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
    return res.status(400).json({
      success: false,
      message: 'Invalid year. Year must be between 2000 and 2100'
    });
  }
  
  const foodSecurityData = await FoodSecurity.find({ tahun: yearInt });
  
  res.status(200).json({
    success: true,
    year: yearInt,
    count: foodSecurityData.length,
    data: foodSecurityData
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
    
    // Add default values for required fields based on the new structure
    const defaultData = {
      independent_variables: {
        produktivitas_padi: 0,
        persentase_penduduk_miskin: 0,
        harga_komoditas_beras: 0,
        persentase_pengeluaran_makanan: 0,
        prevalensi_balita_stunting: 0,
        ipm: 0,
        kepadatan_penduduk: 0,
        ahh: 0,
        persentase_rumah_tangga_dengan_listrik: 0
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
        averageIndex: { $avg: '$dependent_variable.indeks_ketahanan_pangan' },
        count: { $sum: 1 }
      } 
    }
  ]);
  
  const averageIndex = result.length > 0 ? result[0].averageIndex : 0;
  const count = result.length > 0 ? result[0].count : 0;
  
  res.status(200).json({
    success: true,
    year: yearInt,
    averageIndex,
    provincesCount: count
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
    'tahun dependent_variable.indeks_ketahanan_pangan'
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
    index: item.dependent_variable.indeks_ketahanan_pangan
  }));
  
  // Calculate change from previous year
  for (let i = 1; i < formattedTrend.length; i++) {
    formattedTrend[i].change = formattedTrend[i].index - formattedTrend[i-1].index;
    formattedTrend[i].changePercentage = ((formattedTrend[i].index - formattedTrend[i-1].index) / formattedTrend[i-1].index * 100).toFixed(2);
  }
  
  res.status(200).json({
    success: true,
    province: {
      id: province._id,
      name: province.name,
      code: province.code
    },
    data: formattedTrend
  });
});

/**
 * Get provinces ranked by food security index for a year
 */
export const getFoodSecurityRanking = asyncHandler(async (req, res) => {
  const { year } = req.params;
  const yearInt = parseInt(year, 10);
  
  if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
    return res.status(400).json({
      success: false,
      message: 'Invalid year. Year must be between 2000 and 2100'
    });
  }
  
  const ranking = await FoodSecurity.find(
    { tahun: yearInt },
    'provinsi dependent_variable.indeks_ketahanan_pangan'
  ).sort({ 'dependent_variable.indeks_ketahanan_pangan': -1 });
  
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
    index: item.dependent_variable.indeks_ketahanan_pangan
  }));
  
  res.status(200).json({
    success: true,
    year: yearInt,
    totalProvinces: formattedRanking.length,
    ranking: formattedRanking
  });
});

/**
 * Determine food security category based on index value
 * @param {number} indeksKetahananPangan - Food security index value
 * @returns {object} Category information
 */
const determineFoodSecurityCategory = (indeksKetahananPangan) => {
  if (indeksKetahananPangan <= 37.61) {
    return {
      kategori: 1,
      label: 'Sangat Rentan',
      deskripsi: 'Prioritas 1 (Sangat Rentan)'
    };
  } else if (indeksKetahananPangan > 37.61 && indeksKetahananPangan <= 48.27) {
    return {
      kategori: 2,
      label: 'Rentan',
      deskripsi: 'Prioritas 2 (Rentan)'
    };
  } else if (indeksKetahananPangan > 48.27 && indeksKetahananPangan <= 57.11) {
    return {
      kategori: 3,
      label: 'Agak Rentan',
      deskripsi: 'Prioritas 3 (Agak Rentan)'
    };
  } else if (indeksKetahananPangan > 57.11 && indeksKetahananPangan <= 65.96) {
    return {
      kategori: 4,
      label: 'Agak Tahan',
      deskripsi: 'Prioritas 4 (Agak Tahan)'
    };
  } else if (indeksKetahananPangan > 65.96 && indeksKetahananPangan <= 74.40) {
    return {
      kategori: 5,
      label: 'Tahan',
      deskripsi: 'Prioritas 5 (Tahan)'
    };
  } else if (indeksKetahananPangan > 74.40) {
    return {
      kategori: 6,
      label: 'Sangat Tahan',
      deskripsi: 'Prioritas 6 (Sangat Tahan)'
    };
  } else {
    return {
      kategori: null,
      label: 'Tidak Valid',
      deskripsi: 'Indeks tidak valid'
    };
  }
};

/**
 * Update existing food security data with categories
 */
export const updateFoodSecurityCategories = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Check if user is authenticated
    if (!req.isAuthenticated || !req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      throw error;
    }

    // Get all food security data without categories
    const foodSecurityData = await FoodSecurity.find({
      $or: [
        { 'kategori_ketahanan_pangan.kategori': { $exists: false } },
        { 'kategori_ketahanan_pangan.kategori': null }
      ]
    });

    if (foodSecurityData.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'All food security data already have categories assigned',
        updated: 0
      });
    }

    const result = {
      updated: 0,
      failed: 0,
      errors: []
    };

    // Update each record with category
    for (const data of foodSecurityData) {
      try {
        const indeksKetahananPangan = data.dependent_variable.indeks_ketahanan_pangan;
        const categoryInfo = determineFoodSecurityCategory(indeksKetahananPangan);

        await FoodSecurity.findByIdAndUpdate(
          data._id,
          {
            $set: {
              'kategori_ketahanan_pangan': categoryInfo,
              updatedAt: new Date(),
              updatedBy: req.user._id
            }
          },
          { 
            new: true, 
            runValidators: true, 
            session 
          }
        );

        result.updated++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          id: data._id,
          provinsi: data.provinsi,
          tahun: data.tahun,
          error: error.message
        });
      }
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: `Categories updated successfully. Updated: ${result.updated}, Failed: ${result.failed}`,
      result: {
        totalProcessed: foodSecurityData.length,
        updated: result.updated,
        failed: result.failed,
        errors: result.errors
      }
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error updating food security categories:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating food security categories',
      error: error.message
    });
  }
});

/**
 * Get food security statistics by category
 */
export const getFoodSecurityStatsByCategory = asyncHandler(async (req, res) => {
  const { tahun } = req.query;
  
  let matchCondition = {};
  if (tahun) {
    matchCondition.tahun = parseInt(tahun);
  }

  const stats = await FoodSecurity.aggregate([
    { $match: matchCondition },
    {
      $group: {
        _id: '$kategori_ketahanan_pangan.kategori',
        count: { $sum: 1 },
        label: { $first: '$kategori_ketahanan_pangan.label' },
        deskripsi: { $first: '$kategori_ketahanan_pangan.deskripsi' },
        avgIndex: { $avg: '$dependent_variable.indeks_ketahanan_pangan' },
        minIndex: { $min: '$dependent_variable.indeks_ketahanan_pangan' },
        maxIndex: { $max: '$dependent_variable.indeks_ketahanan_pangan' },
        provinces: { $push: '$provinsi' }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);

  // Calculate total for percentage
  const total = stats.reduce((sum, stat) => sum + stat.count, 0);
  
  // Add percentage to each category
  const statsWithPercentage = stats.map(stat => ({
    ...stat,
    percentage: total > 0 ? ((stat.count / total) * 100).toFixed(2) : 0
  }));

  return res.status(200).json({
    success: true,
    year: tahun || 'All years',
    totalProvinces: total,
    statistics: statsWithPercentage
  });
});

/**
 * Get provinces by food security category
 */
export const getProvincesByCategory = asyncHandler(async (req, res) => {
  const { kategori } = req.params;
  const { tahun } = req.query;

  let matchCondition = {
    'kategori_ketahanan_pangan.kategori': parseInt(kategori)
  };
  
  if (tahun) {
    matchCondition.tahun = parseInt(tahun);
  }

  const provinces = await FoodSecurity.find(matchCondition)
    .select('provinsi tahun dependent_variable.indeks_ketahanan_pangan kategori_ketahanan_pangan')
    .sort({ 'dependent_variable.indeks_ketahanan_pangan': 1 });

  if (provinces.length === 0) {
    return res.status(404).json({
      success: false,
      message: `No provinces found for category ${kategori}`
    });
  }

  return res.status(200).json({
    success: true,
    category: provinces[0].kategori_ketahanan_pangan,
    year: tahun || 'All years',
    count: provinces.length,
    provinces: provinces
  });
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
    
    // Default values for required independent variables
    const defaultIndependentVars = {
      produktivitas_padi: 0,
      persentase_penduduk_miskin: 0,
      harga_komoditas_beras: 0,
      persentase_pengeluaran_makanan: 0,
      prevalensi_balita_stunting: 0,
      ipm: 0,
      ahh: 0,
      persentase_rumah_tangga_dengan_listrik: 0,
      kepadatan_penduduk: 0
    };
    
    // Process each food security data entry
    for (const [index, data] of foodSecurityData.entries()) {
      try {
        result.processedCount++;
        
        const { provinceId, tahun, dependent_variable, independent_variables } = data;
        
        // Validate required fields
        if (!provinceId || !tahun || !dependent_variable?.indeks_ketahanan_pangan) {
          throw new Error('Missing required fields: provinceId, tahun, or dependent_variable.indeks_ketahanan_pangan');
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

        // Determine food security category
        const categoryInfo = determineFoodSecurityCategory(dependent_variable.indeks_ketahanan_pangan);
        
        // Prepare the data to save
        const foodSecurityEntry = {
          provinsi: province.name,
          tahun,
          provinceReference: provinceId,
          dependent_variable: {
            indeks_ketahanan_pangan: dependent_variable.indeks_ketahanan_pangan
          },
          independent_variables: {
            ...defaultIndependentVars,
            ...(independent_variables || {})
          },
          kategori_ketahanan_pangan: categoryInfo,
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

// Validate bulk import data format
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
  const requiredDependentVar = 'dependent_variable.indeks_ketahanan_pangan';
  
  for (const [index, data] of foodSecurityData.entries()) {
    const entryErrors = [];
    
    // Check required fields
    requiredFields.forEach(field => {
      if (!data[field]) {
        entryErrors.push(`Missing required field: ${field}`);
      }
    });
    
    // Check dependent variable
    if (!data.dependent_variable?.indeks_ketahanan_pangan) {
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
    if (data.dependent_variable?.indeks_ketahanan_pangan !== undefined) {
      const index = data.dependent_variable.indeks_ketahanan_pangan;
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
 * Modified create method with category determination
 */
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

    const { provinceId, tahun, dependent_variable } = req.body;
    
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
      const error = new Error(`Food security data for ${province.name} in year ${tahun} already exists`);
      error.statusCode = 409;
      throw error;
    }

    // Determine food security category
    const categoryInfo = determineFoodSecurityCategory(dependent_variable.indeks_ketahanan_pangan);

    // Set the province name from the found province object
    req.body.provinsi = province.name;
    // Store province ID as a reference
    req.body.provinceReference = provinceId;
    // Add category information
    req.body.kategori_ketahanan_pangan = categoryInfo;

    const foodSecurity = await FoodSecurity.create([req.body], { session });
    
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      data: {
        ...foodSecurity[0]._doc,
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
      message: 'Error creating food security data',
      error: error.message
    });
  }
});

/**
 * Get food security data by province and year (specific combination)
 */
export const getFoodSecurityByProvinceAndYear = asyncHandler(async (req, res) => {
  const { id: provinceId, year } = req.params;
  
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
  
  const foodSecurityData = await FoodSecurity.findOne(query);
  
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
