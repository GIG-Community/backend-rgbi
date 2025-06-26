import mongoose from 'mongoose';
import FoodSecurity from '../models/foodsecurity.model.js';
import Province from '../models/province.model.js';

/**
 * Get all food security data with pagination
 */
export const getAllFoodSecurityData = async (req, res, next) => {
  try {
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
  } catch (error) {
    next(error);
  }
};

/**
 * Get food security data by ID
 */
export const getFoodSecurityById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error('Invalid ID format');
      error.statusCode = 400;
      throw error;
    }
    
    const foodSecurityData = await FoodSecurity.findById(id);
    
    if (!foodSecurityData) {
      const error = new Error('Food security data not found');
      error.statusCode = 404;
      throw error;
    }
    
    res.status(200).json({
      success: true,
      data: foodSecurityData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get food security data by province
 */
export const getFoodSecurityByProvince = async (req, res, next) => {
  try {
    const { id: provinceId } = req.params;
    const { year } = req.query;
    
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
  } catch (error) {
    next(error);
  }
};

/**
 * Get food security data by year
 */
export const getFoodSecurityByYear = async (req, res, next) => {
  try {
    const { year } = req.params;
    const yearInt = parseInt(year, 10);
    
    if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
      const error = new Error('Invalid year. Year must be between 2000 and 2100');
      error.statusCode = 400;
      throw error;
    }
    
    const foodSecurityData = await FoodSecurity.find({ tahun: yearInt });
    
    res.status(200).json({
      success: true,
      year: yearInt,
      count: foodSecurityData.length,
      data: foodSecurityData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new food security data
 */
export const createFoodSecurityData = async (req, res, next) => {
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
        harga_komdistas_beras: 0,
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
    
    next(error);
  }
};

/**
 * Update food security data
 */
export const updateFoodSecurityData = async (req, res, next) => {
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
    next(error);
  }
};

/**
 * Delete food security data
 */
export const deleteFoodSecurityData = async (req, res, next) => {
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
    next(error);
  }
};

/**
 * Get average food security index by year
 */
export const getAverageFoodSecurityByYear = async (req, res, next) => {
  try {
    const { year } = req.params;
    const yearInt = parseInt(year, 10);
    
    if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
      const error = new Error('Invalid year. Year must be between 2000 and 2100');
      error.statusCode = 400;
      throw error;
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
  } catch (error) {
    next(error);
  }
};

/**
 * Get food security trend for a province over years
 */
export const getFoodSecurityTrend = async (req, res, next) => {
  try {
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
  } catch (error) {
    next(error);
  }
};

/**
 * Get provinces ranked by food security index for a year
 */
export const getFoodSecurityRanking = async (req, res, next) => {
  try {
    const { year } = req.params;
    const yearInt = parseInt(year, 10);
    
    if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2100) {
      const error = new Error('Invalid year. Year must be between 2000 and 2100');
      error.statusCode = 400;
      throw error;
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
  } catch (error) {
    next(error);
  }
};