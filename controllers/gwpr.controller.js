import mongoose from 'mongoose';
import GWPR from '../models/gwpr.model.js';
import FoodSecurity from '../models/foodsecurity.model.js';
import Province from '../models/province.model.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Create GWPR data (simple version)
 */
export const createGWPR = asyncHandler(async (req, res) => {
  try {
    if (!req.isAuthenticated || !req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { provinceId, kelompok, variabel_signifikan, periode_analisis } = req.body;
    
    // Basic validation
    if (!provinceId || !kelompok || !variabel_signifikan) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: provinceId, kelompok, variabel_signifikan'
      });
    }
    
    // Check if configuration already exists for this province and kelompok
    const existingConfig = await GWPR.findOne({ 
      provinceId: provinceId,
      kelompok: kelompok
    });
    
    if (existingConfig) {
      return res.status(409).json({
        success: false,
        message: 'GWPR configuration already exists for this province and kelompok'
      });
    }
    
    // Create new GWPR entry with correct fields
    const newGWPR = {
      kelompok,
      provinceId: provinceId,
      variabel_signifikan,
      periode_analisis: periode_analisis || {
        tahun_mulai: 2018,
        tahun_selesai: 2023
      },
      // Optional fields
      ...(req.body.koefisien_regresi && { koefisien_regresi: req.body.koefisien_regresi }),
      ...(req.body.r_squared && { r_squared: req.body.r_squared }),
      ...(req.body.adjusted_r_squared && { adjusted_r_squared: req.body.adjusted_r_squared }),
      ...(req.body.bandwidth && { bandwidth: req.body.bandwidth }),
      createdBy: req.user.name || req.user._id,
      userRole: req.user.role
    };
    
    const createdGWPR = await GWPR.create(newGWPR);
    
    res.status(201).json({
      success: true,
      message: 'GWPR created successfully',
      data: createdGWPR
    });
    
  } catch (error) {
    console.error('Error creating GWPR:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * Get GWPR analysis with actual food security data
 */
export const getGWPRAnalysis = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    sortBy = 'kelompok', 
    order = 'asc',
    tahun,
    kelompok,
    variabel,
    provinsi
  } = req.query;
  
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { [sortBy]: order === 'desc' ? -1 : 1 }
  };
  
  // Build filter for GWPR config
  let gwprFilter = {};
  if (tahun) gwprFilter.tahun = parseInt(tahun, 10);
  if (kelompok) gwprFilter.kelompok = parseInt(kelompok, 10);
  if (variabel) gwprFilter.variabel_signifikan = { $in: [variabel] };
  if (provinsi) gwprFilter.provinsi = { $regex: provinsi, $options: 'i' };
  
  // Get GWPR configurations
  const gwprConfigs = await GWPR.find(gwprFilter)
    .populate('provinceId', 'name code')
    .skip((options.page - 1) * options.limit)
    .limit(options.limit)
    .sort(options.sort);
  
  // Fetch actual food security data for each province
  const enrichedData = await Promise.all(
    gwprConfigs.map(async (config) => {
      // Get actual food security data for this province and year
      const foodSecurityData = await FoodSecurity.findOne({
        provinsi: config.provinsi,
        tahun: config.tahun
      });
      
      // Extract significant variable values from food security data
      const significantVariableValues = {};
      const actualVariableData = {};
      
      if (foodSecurityData) {
        config.variabel_signifikan.forEach(varName => {
          const value = foodSecurityData.independent_variables[varName];
          significantVariableValues[varName] = value;
          actualVariableData[varName] = {
            name: varName,
            value: value,
            coefficient: config.koefisien_regresi ? config.koefisien_regresi[varName] : null
          };
        });
      }
      
      return {
        ...config.toObject(),
        foodSecurityData: {
          dependent_variable: foodSecurityData?.dependent_variable || null,
          significant_variables: significantVariableValues,
          all_independent_variables: foodSecurityData?.independent_variables || null
        },
        actualVariableData,
        dataAvailable: !!foodSecurityData
      };
    })
  );
  
  const total = await GWPR.countDocuments(gwprFilter);
  
  res.status(200).json({
    success: true,
    data: enrichedData,
    filters: {
      applied: gwprFilter
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
 * Get GWPR analysis by province with time series
 */
export const getGWPRByProvince = asyncHandler(async (req, res) => {
  const { id: provinceId } = req.params;
  const { year } = req.query;
  
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
  
  let gwprQuery = { provinsi: province.name };
  if (year) gwprQuery.tahun = parseInt(year, 10);
  
  const gwprConfigs = await GWPR.find(gwprQuery)
    .populate('provinceId', 'name code')
    .sort({ tahun: 1 });
  
  // Get all food security data for this province
  let foodSecurityQuery = { provinsi: province.name };
  if (year) foodSecurityQuery.tahun = parseInt(year, 10);
  
  const foodSecurityData = await FoodSecurity.find(foodSecurityQuery).sort({ tahun: 1 });
  
  // Create a map for quick lookup
  const foodSecurityMap = {};
  foodSecurityData.forEach(data => {
    foodSecurityMap[data.tahun] = data;
  });
  
  // Enrich GWPR configs with actual data
  const enrichedData = gwprConfigs.map(config => {
    const yearData = foodSecurityMap[config.tahun];
    const significantVariableValues = {};
    const actualVariableData = {};
    
    if (yearData) {
      config.variabel_signifikan.forEach(varName => {
        const value = yearData.independent_variables[varName];
        significantVariableValues[varName] = value;
        actualVariableData[varName] = {
          name: varName,
          value: value,
          coefficient: config.koefisien_regresi ? config.koefisien_regresi[varName] : null
        };
      });
    }
    
    return {
      ...config.toObject(),
      foodSecurityData: {
        dependent_variable: yearData?.dependent_variable || null,
        significant_variables: significantVariableValues,
        all_independent_variables: yearData?.independent_variables || null
      },
      actualVariableData,
      dataAvailable: !!yearData
    };
  });
  
  return res.status(200).json({
    success: true,
    province: {
      id: province._id,
      name: province.name,
      code: province.code
    },
    count: enrichedData.length,
    data: enrichedData
  });
});

/**
 * Get GWPR analysis by year
 */
export const getGWPRByYear = asyncHandler(async (req, res) => {
  const { year } = req.params;
  const { sortBy = 'kelompok', order = 'asc' } = req.query;
  const yearInt = parseInt(year, 10);
  
  if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
    return res.status(400).json({
      success: false,
      message: 'Invalid year. Year must be between 2000 and 2100'
    });
  }
  
  const sortOptions = { [sortBy]: order === 'desc' ? -1 : 1 };
  const gwprConfigs = await GWPR.find({ tahun: yearInt })
    .populate('provinceId', 'name code')
    .sort(sortOptions);
  
  // Get all food security data for this year
  const foodSecurityData = await FoodSecurity.find({ tahun: yearInt });
  
  // Create province-based lookup map
  const foodSecurityMap = {};
  foodSecurityData.forEach(data => {
    foodSecurityMap[data.provinsi] = data;
  });
  
  // Enrich GWPR data with actual food security values
  const enrichedData = gwprConfigs.map(config => {
    const provinceData = foodSecurityMap[config.provinsi];
    const significantVariableValues = {};
    const actualVariableData = {};
    
    if (provinceData) {
      config.variabel_signifikan.forEach(varName => {
        const value = provinceData.independent_variables[varName];
        significantVariableValues[varName] = value;
        actualVariableData[varName] = {
          name: varName,
          value: value,
          coefficient: config.koefisien_regresi ? config.koefisien_regresi[varName] : null
        };
      });
    }
    
    return {
      ...config.toObject(),
      foodSecurityData: {
        dependent_variable: provinceData?.dependent_variable || null,
        significant_variables: significantVariableValues,
        all_independent_variables: provinceData?.independent_variables || null
      },
      actualVariableData,
      dataAvailable: !!provinceData
    };
  });
  
  res.status(200).json({
    success: true,
    year: yearInt,
    count: enrichedData.length,
    data: enrichedData
  });
});

/**
 * Get GWPR analysis by group (kelompok)
 */
export const getGWPRByGroup = asyncHandler(async (req, res) => {
  const { kelompok } = req.params;
  const { year, sortBy = 'provinsi', order = 'asc' } = req.query;
  
  const kelompokInt = parseInt(kelompok, 10);
  if (isNaN(kelompokInt) || kelompokInt < 1) {
    return res.status(400).json({
      success: false,
      message: 'Invalid kelompok. Must be a positive integer'
    });
  }
  
  let query = { kelompok: kelompokInt };
  if (year) query.tahun = parseInt(year, 10);
  
  const sortOptions = { [sortBy]: order === 'desc' ? -1 : 1 };
  const gwprConfigs = await GWPR.find(query)
    .populate('provinceId', 'name code')
    .sort(sortOptions);
  
  // Get food security data for these provinces and years
  const provinceYearPairs = gwprConfigs.map(config => ({
    provinsi: config.provinsi,
    tahun: config.tahun
  }));
  
  const foodSecurityData = await FoodSecurity.find({
    $or: provinceYearPairs
  });
  
  // Create lookup map
  const foodSecurityMap = {};
  foodSecurityData.forEach(data => {
    const key = `${data.provinsi}_${data.tahun}`;
    foodSecurityMap[key] = data;
  });
  
  // Enrich data
  const enrichedData = gwprConfigs.map(config => {
    const key = `${config.provinsi}_${config.tahun}`;
    const yearData = foodSecurityMap[key];
    const significantVariableValues = {};
    const actualVariableData = {};
    
    if (yearData) {
      config.variabel_signifikan.forEach(varName => {
        const value = yearData.independent_variables[varName];
        significantVariableValues[varName] = value;
        actualVariableData[varName] = {
          name: varName,
          value: value,
          coefficient: config.koefisien_regresi ? config.koefisien_regresi[varName] : null
        };
      });
    }
    
    return {
      ...config.toObject(),
      foodSecurityData: {
        dependent_variable: yearData?.dependent_variable || null,
        significant_variables: significantVariableValues,
        all_independent_variables: yearData?.independent_variables || null
      },
      actualVariableData,
      dataAvailable: !!yearData
    };
  });
  
  res.status(200).json({
    success: true,
    kelompok: kelompokInt,
    year: year ? parseInt(year, 10) : 'all',
    count: enrichedData.length,
    data: enrichedData
  });
});

/**
 * Get GWPR statistics by variable with actual values
 */
export const getGWPRStatsByVariable = asyncHandler(async (req, res) => {
  const { variabel } = req.params;
  const { year } = req.query;
  
  // Validate variable name
  if (!Object.keys(variableMapping).includes(variabel)) {
    return res.status(400).json({
      success: false,
      message: `Invalid variable: ${variabel}`,
      availableVariables: Object.keys(variableMapping)
    });
  }
  
  let matchStage = { variabel_signifikan: { $in: [variabel] } };
  if (year) matchStage.tahun = parseInt(year, 10);
  
  const gwprConfigs = await GWPR.find(matchStage);
  
  // Get actual food security data for these configurations
  const provinceYearPairs = gwprConfigs.map(config => ({
    provinsi: config.provinsi,
    tahun: config.tahun
  }));
  
  const foodSecurityData = await FoodSecurity.find({
    $or: provinceYearPairs
  });
  
  // Create lookup and calculate statistics
  const foodSecurityMap = {};
  foodSecurityData.forEach(data => {
    const key = `${data.provinsi}_${data.tahun}`;
    foodSecurityMap[key] = data;
  });
  
  // Group statistics by kelompok
  const groupStats = {};
  const actualValues = [];
  
  gwprConfigs.forEach(config => {
    const key = `${config.provinsi}_${config.tahun}`;
    const yearData = foodSecurityMap[key];
    
    if (yearData) {
      const actualValue = yearData.independent_variables[variabel];
      if (actualValue !== undefined) {
        actualValues.push(actualValue);
        
        if (!groupStats[config.kelompok]) {
          groupStats[config.kelompok] = {
            count: 0,
            provinces: [],
            values: [],
            avgCoefficient: 0,
            coefficients: []
          };
        }
        
        groupStats[config.kelompok].count++;
        groupStats[config.kelompok].provinces.push(config.provinsi);
        groupStats[config.kelompok].values.push(actualValue);
        
        if (config.koefisien_regresi && config.koefisien_regresi[variabel]) {
          groupStats[config.kelompok].coefficients.push(config.koefisien_regresi[variabel]);
        }
      }
    }
  });
  
  // Finalize statistics
  Object.keys(groupStats).forEach(kelompok => {
    const group = groupStats[kelompok];
    group.avgValue = group.values.reduce((a, b) => a + b, 0) / group.values.length;
    group.minValue = Math.min(...group.values);
    group.maxValue = Math.max(...group.values);
    
    if (group.coefficients.length > 0) {
      group.avgCoefficient = group.coefficients.reduce((a, b) => a + b, 0) / group.coefficients.length;
    }
  });
  
  // Overall statistics
  const overallStats = {
    total: actualValues.length,
    average: actualValues.length > 0 ? actualValues.reduce((a, b) => a + b, 0) / actualValues.length : 0,
    min: actualValues.length > 0 ? Math.min(...actualValues) : 0,
    max: actualValues.length > 0 ? Math.max(...actualValues) : 0
  };
  
  res.status(200).json({
    success: true,
    variable: {
      name: variabel,
      code: variableMapping[variabel]
    },
    year: year ? parseInt(year, 10) : 'all',
    overallStatistics: overallStats,
    groupStatistics: groupStats
  });
});

/**
 * Bulk import GWPR configurations (basic configuration only)
 */
export const bulkImportGWPR = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    if (!req.isAuthenticated || !req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      throw error;
    }

    const { gwprData } = req.body;
    
    if (!gwprData || !Array.isArray(gwprData) || gwprData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid gwprData array is required'
      });
    }
    
    const result = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
      processedCount: 0
    };
    
    // Process each GWPR configuration entry
    for (const [index, data] of gwprData.entries()) {
      try {
        result.processedCount++;
        
        const { provinceId, tahun, kelompok, variabel_signifikan } = data;
        
        // Validate required fields (only configuration fields)
        if (!provinceId || !tahun || !kelompok || !variabel_signifikan) {
          throw new Error('Missing required fields: provinceId, tahun, kelompok, or variabel_signifikan');
        }
        
        if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2100) {
          throw new Error(`Invalid year: ${tahun}. Year must be an integer between 2000 and 2100`);
        }
        
        if (!Number.isInteger(kelompok) || kelompok < 1) {
          throw new Error(`Invalid kelompok: ${kelompok}. Must be a positive integer`);
        }
        
        if (!Array.isArray(variabel_signifikan) || variabel_signifikan.length === 0) {
          throw new Error('variabel_signifikan must be a non-empty array');
        }
        
        if (!mongoose.Types.ObjectId.isValid(provinceId)) {
          throw new Error(`Invalid provinceId format: ${provinceId}`);
        }
        
        const province = await Province.findById(provinceId);
        if (!province) {
          throw new Error(`Province not found with ID: ${provinceId}`);
        }
        
        // Check if configuration already exists
        const existingData = await GWPR.findOne({ 
          provinsi: province.name, 
          tahun 
        });
        
        // Only store essential configuration data
        const gwprEntry = {
          kelompok,
          tahun,
          provinsi: province.name,
          provinceId: provinceId,
          variabel_signifikan,
          // Optional analysis results (if provided)
          ...(data.koefisien_regresi && { koefisien_regresi: data.koefisien_regresi }),
          ...(data.r_squared && { r_squared: data.r_squared }),
          ...(data.adjusted_r_squared && { adjusted_r_squared: data.adjusted_r_squared }),
          ...(data.bandwidth && { bandwidth: data.bandwidth }),
          createdBy: req.user.name || req.user._id,
          userRole: req.user.role,
          createdAt: new Date()
        };
        
        if (existingData) {
          const updateData = {
            ...gwprEntry,
            updatedAt: new Date(),
            updatedBy: req.user._id
          };
          
          await GWPR.findByIdAndUpdate(
            existingData._id,
            { $set: updateData },
            { new: true, runValidators: true, session }
          );
          
          result.updated++;
        } else {
          await GWPR.create([gwprEntry], { session });
          result.created++;
        }
        
      } catch (error) {
        result.failed++;
        result.errors.push({
          index: index + 1,
          data: data,
          error: error.message
        });
        
        console.error(`Error processing GWPR data at index ${index + 1}:`, error.message);
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
        errors: result.errors
      }
    });
    
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error bulk importing GWPR data:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error during bulk import',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Error bulk importing GWPR data',
      error: error.message
    });
  }
});

/**
 * Validate bulk import data format
 */
export const validateBulkImportData = asyncHandler(async (req, res) => {
  const { gwprData } = req.body;
  
  if (!gwprData || !Array.isArray(gwprData)) {
    return res.status(400).json({
      success: false,
      message: 'gwprData must be an array'
    });
  }
  
  const validationResults = {
    totalEntries: gwprData.length,
    validEntries: 0,
    invalidEntries: 0,
    errors: []
  };
  
  const requiredFields = ['provinceId', 'tahun', 'kelompok', 'variabel_signifikan'];
  const validVariables = [
    'persentase_nilai_perdagangan_domestik',
    'indeks_harga_implisit',
    'koefisien_gini',
    'indeks_pembangunan_manusia',
    'kepadatan_penduduk',
    'ketersediaan_infrastruktur_jalan',
    'indeks_kemahalan_konstruksi',
    'indeks_demokrasi_indonesia'
  ];
  
  for (const [index, data] of gwprData.entries()) {
    const entryErrors = [];
    
    // Check required fields
    requiredFields.forEach(field => {
      if (data[field] === undefined || data[field] === null) {
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
    
    // Validate kelompok
    if (data.kelompok && (!Number.isInteger(data.kelompok) || data.kelompok < 1)) {
      entryErrors.push(`Invalid kelompok: ${data.kelompok}. Must be a positive integer`);
    }
    
    // Validate variabel_signifikan
    if (data.variabel_signifikan && Array.isArray(data.variabel_signifikan)) {
      const invalidVars = data.variabel_signifikan.filter(v => !validVariables.includes(v));
      if (invalidVars.length > 0) {
        entryErrors.push(`Invalid variables: ${invalidVars.join(', ')}`);
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
    readyForImport: validationResults.invalidEntries === 0,
    availableVariables: validVariables
  });
});

/**
 * Get all GWPR configurations (metadata only)
 */
export const getAllGWPRConfigs = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    sortBy = 'tahun', 
    order = 'desc',
    tahun,
    kelompok,
    variabel,
    provinsi
  } = req.query;
  
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { [sortBy]: order === 'desc' ? -1 : 1 }
  };
  
  // Build filter for GWPR config
  let gwprFilter = {};
  if (tahun) gwprFilter.tahun = parseInt(tahun, 10);
  if (kelompok) gwprFilter.kelompok = parseInt(kelompok, 10);
  if (variabel) gwprFilter.variabel_signifikan = { $in: [variabel] };
  if (provinsi) gwprFilter.provinsi = { $regex: provinsi, $options: 'i' };
  
  // Get GWPR configurations only (no food security data)
  const gwprConfigs = await GWPR.find(gwprFilter)
    .populate('provinceId', 'name code')
    .skip((options.page - 1) * options.limit)
    .limit(options.limit)
    .sort(options.sort);
  
  const total = await GWPR.countDocuments(gwprFilter);
  
  res.status(200).json({
    success: true,
    data: gwprConfigs,
    filters: {
      applied: gwprFilter
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
 * Get GWPR config by ID (metadata only)
 */
export const getConfigById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }
  
  const gwprConfig = await GWPR.findById(id).populate('provinceId', 'name code');
  
  if (!gwprConfig) {
    return res.status(404).json({
      success: false,
      message: 'GWPR configuration not found'
    });
  }
  
  res.status(200).json({
    success: true,
    data: gwprConfig
  });
});

/**
 * Get GWPR configs by year (metadata only)
 */
export const getConfigsByYear = asyncHandler(async (req, res) => {
  const { year } = req.params;
  const { sortBy = 'kelompok', order = 'asc' } = req.query;
  const yearInt = parseInt(year, 10);
  
  if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
    return res.status(400).json({
      success: false,
      message: 'Invalid year. Year must be between 2000 and 2100'
    });
  }
  
  const sortOptions = { [sortBy]: order === 'desc' ? -1 : 1 };
  const gwprConfigs = await GWPR.find({ tahun: yearInt })
    .populate('provinceId', 'name code')
    .sort(sortOptions);
  
  res.status(200).json({
    success: true,
    year: yearInt,
    count: gwprConfigs.length,
    data: gwprConfigs
  });
});

/**
 * Get GWPR configs by province (metadata only)
 */
export const getConfigsByProvince = asyncHandler(async (req, res) => {
  const { id: provinceId } = req.params;
  const { year } = req.query;
  
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
  
  let gwprQuery = { provinsi: province.name };
  if (year) gwprQuery.tahun = parseInt(year, 10);
  
  const gwprConfigs = await GWPR.find(gwprQuery)
    .populate('provinceId', 'name code')
    .sort({ tahun: 1 });
  
  return res.status(200).json({
    success: true,
    province: {
      id: province._id,
      name: province.name,
      code: province.code
    },
    count: gwprConfigs.length,
    data: gwprConfigs
  });
});

/**
 * Create GWPR configuration (set which variables are significant for a province)
 */
export const createGWPRConfig = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    if (!req.isAuthenticated || !req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      throw error;
    }

    const { provinceId, tahun, kelompok, variabel_signifikan } = req.body;
    
    if (!Number.isInteger(tahun)) {
      const error = new Error('Year must be an integer');
      error.statusCode = 400;
      throw error;
    }
    
    if (!Number.isInteger(kelompok) || kelompok < 1) {
      const error = new Error('Kelompok must be a positive integer');
      error.statusCode = 400;
      throw error;
    }
    
    if (!variabel_signifikan || !Array.isArray(variabel_signifikan) || variabel_signifikan.length === 0) {
      const error = new Error('variabel_signifikan must be a non-empty array');
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
    
    // Check if configuration already exists for this province and year
    const existingConfig = await GWPR.findOne({ provinsi: province.name, tahun });
    
    if (existingConfig) {
      const error = new Error('GWPR configuration already exists for this province and year');
      error.statusCode = 409;
      throw error;
    }
    
    // Only store configuration data (kelompok, variabel_signifikan)
    // koefisien_regresi is optional and can be added later from analysis
    let newConfig = {
      kelompok,
      tahun,
      provinsi: province.name,
      provinceId: provinceId,
      variabel_signifikan,
      // Optional fields from request body (if provided)
      ...(req.body.koefisien_regresi && { koefisien_regresi: req.body.koefisien_regresi }),
      ...(req.body.r_squared && { r_squared: req.body.r_squared }),
      ...(req.body.adjusted_r_squared && { adjusted_r_squared: req.body.adjusted_r_squared }),
      ...(req.body.bandwidth && { bandwidth: req.body.bandwidth }),
      createdBy: req.user.name,
      userRole: req.user.role
    };
    
    const newGWPRConfig = await GWPR.create([newConfig], { session });
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(201).json({
      success: true,
      message: 'GWPR configuration created successfully',
      data: {
        ...newGWPRConfig[0]._doc,
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
 * Update GWPR configuration
 */
export const updateGWPRConfig = asyncHandler(async (req, res) => {
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
    
    const existingConfig = await GWPR.findById(id);
    
    if (!existingConfig) {
      const error = new Error('GWPR configuration not found');
      error.statusCode = 404;
      throw error;
    }
    
    // Prevent changing province and year
    if (req.body.provinsi && req.body.provinsi !== existingConfig.provinsi) {
      const error = new Error('Province cannot be modified');
      error.statusCode = 400;
      throw error;
    }
    
    if (req.body.tahun && req.body.tahun !== existingConfig.tahun) {
      const error = new Error('Year cannot be modified');
      error.statusCode = 400;
      throw error;
    }
    
    const updateData = {
      ...req.body,
      updatedAt: new Date(),
      updatedBy: req.user._id
    };
    
    const updatedConfig = await GWPR.findByIdAndUpdate(
      id, 
      { $set: updateData },
      { new: true, runValidators: true, session }
    ).populate('provinceId', 'name code');
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({
      success: true,
      message: 'GWPR configuration updated successfully',
      data: updatedConfig
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
 * Delete GWPR configuration
 */
export const deleteGWPRConfig = asyncHandler(async (req, res) => {
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
    
    const deletedConfig = await GWPR.findByIdAndDelete(id).session(session);
    
    if (!deletedConfig) {
      const error = new Error('GWPR configuration not found');
      error.statusCode = 404;
      throw error;
    }
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({
      success: true,
      message: 'GWPR configuration deleted successfully'
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

// GWPR Controller (Simplified CRUD operations)

// Get all GWPR records
export const getAllGWPR = async (req, res) => {
  try {
    const gwprRecords = await GWPR.find()
      .populate('provinceId', 'name')
      .sort({ kelompok: 1, 'periode_analisis.tahun_mulai': -1 });
    
    res.status(200).json({
      success: true,
      data: gwprRecords
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch GWPR records',
      error: error.message
    });
  }
};

// Get GWPR by ID
export const getGWPRById = async (req, res) => {
  try {
    const gwpr = await GWPR.findById(req.params.id)
      .populate('provinceId', 'name');
    
    if (!gwpr) {
      return res.status(404).json({
        success: false,
        message: 'GWPR record not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: gwpr
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch GWPR record',
      error: error.message
    });
  }
};

// Create new GWPR record
export const createGWPRRecord = async (req, res) => {
  try {
    const newGWPR = new GWPR(req.body);
    const savedGWPR = await newGWPR.save();
    
    res.status(201).json({
      success: true,
      message: 'GWPR record created successfully',
      data: savedGWPR
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'GWPR record for this province and kelompok already exists'
      });
    }
    
    res.status(400).json({
      success: false,
      message: 'Failed to create GWPR record',
      error: error.message
    });
  }
};

// Update GWPR record
export const updateGWPR = async (req, res) => {
  try {
    const updatedGWPR = await GWPR.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate('provinceId', 'name');
    
    if (!updatedGWPR) {
      return res.status(404).json({
        success: false,
        message: 'GWPR record not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'GWPR record updated successfully',
      data: updatedGWPR
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to update GWPR record',
      error: error.message
    });
  }
};

// Delete GWPR record
export const deleteGWPR = async (req, res) => {
  try {
    const deletedGWPR = await GWPR.findByIdAndDelete(req.params.id);
    
    if (!deletedGWPR) {
      return res.status(404).json({
        success: false,
        message: 'GWPR record not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'GWPR record deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete GWPR record',
      error: error.message
    });
  }
};

// Get GWPR by province (simple version)
export const getGWPRByProvinceSimple = async (req, res) => {
  try {
    const gwprRecords = await GWPR.find({ provinceId: req.params.provinceId })
      .populate('provinceId', 'name')
      .sort({ kelompok: 1 });
    
    res.status(200).json({
      success: true,
      data: gwprRecords
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch GWPR records by province',
      error: error.message
    });
  }
};

// Get GWPR by kelompok
export const getGWPRByKelompok = async (req, res) => {
  try {
    const gwprRecords = await GWPR.find({ kelompok: req.params.kelompok })
      .populate('provinceId', 'name')
      .sort({ 'provinceId.name': 1 });
    
    res.status(200).json({
      success: true,
      data: gwprRecords
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch GWPR records by kelompok',
      error: error.message
    });
  }
};

// Bulk create GWPR records
export const bulkCreateGWPR = async (req, res) => {
  try {
    const { records } = req.body;
    
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Records array is required and cannot be empty'
      });
    }
    
    const createdGWPR = await GWPR.insertMany(records, { ordered: false });
    
    res.status(201).json({
      success: true,
      message: `${createdGWPR.length} GWPR records created successfully`,
      data: createdGWPR
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Some GWPR records already exist for the same province and kelompok',
        error: error.message
      });
    }
    
    res.status(400).json({
      success: false,
      message: 'Failed to bulk create GWPR records',
      error: error.message
    });
  }
};
