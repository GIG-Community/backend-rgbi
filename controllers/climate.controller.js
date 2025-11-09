import Climate from '../models/climate.model.js';

// Get all Climate records
export const getAllClimate = async (req, res) => {
  try {
    const climateRecords = await Climate.find()
      .populate('provinceId', 'name')
      .sort({ tahun: -1, bulan: -1 });
    
    res.status(200).json({
      success: true,
      data: climateRecords
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Climate records',
      error: error.message
    });
  }
};

// Get Climate by ID
export const getClimateById = async (req, res) => {
  try {
    const climate = await Climate.findById(req.params.id)
      .populate('provinceId', 'name');
    
    if (!climate) {
      return res.status(404).json({
        success: false,
        message: 'Climate record not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: climate
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Climate record',
      error: error.message
    });
  }
};

// Create new Climate record
export const createClimate = async (req, res) => {
  try {
    const newClimate = new Climate(req.body);
    const savedClimate = await newClimate.save();
    
    res.status(201).json({
      success: true,
      message: 'Climate record created successfully',
      data: savedClimate
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Climate record for this province, month, and year already exists'
      });
    }
    
    res.status(400).json({
      success: false,
      message: 'Failed to create Climate record',
      error: error.message
    });
  }
};

// Update Climate record
export const updateClimate = async (req, res) => {
  try {
    const updatedClimate = await Climate.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!updatedClimate) {
      return res.status(404).json({
        success: false,
        message: 'Climate record not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Climate record updated successfully',
      data: updatedClimate
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to update Climate record',
      error: error.message
    });
  }
};

// Delete Climate record
export const deleteClimate = async (req, res) => {
  try {
    const deletedClimate = await Climate.findByIdAndDelete(req.params.id);
    
    if (!deletedClimate) {
      return res.status(404).json({
        success: false,
        message: 'Climate record not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Climate record deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete Climate record',
      error: error.message
    });
  }
};

// Get Climate by province
export const getClimateByProvince = async (req, res) => {
  try {
    const climateRecords = await Climate.find({ provinceId: req.params.provinceId })
      .populate('provinceId', 'name')
      .sort({ tahun: -1, bulan: -1 });
    
    res.status(200).json({
      success: true,
      data: climateRecords
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Climate records by province',
      error: error.message
    });
  }
};

// Get Climate by year
export const getClimateByYear = async (req, res) => {
  try {
    const climateRecords = await Climate.find({ tahun: req.params.year })
      .sort({ bulan: 1, provinsi: 1 });
    
    res.status(200).json({
      success: true,
      data: climateRecords
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Climate records by year',
      error: error.message
    });
  }
};

// Bulk create Climate records
export const bulkCreateClimate = async (req, res) => {
  try {
    const { records } = req.body;
    
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Records array is required and cannot be empty'
      });
    }
    
    const createdClimate = await Climate.insertMany(records, { ordered: false });
    
    res.status(201).json({
      success: true,
      message: `${createdClimate.length} Climate records created successfully`,
      data: createdClimate
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Some Climate records already exist for the same province, month, and year',
        error: error.message
      });
    }
    
    res.status(400).json({
      success: false,
      message: 'Failed to bulk create Climate records',
      error: error.message
    });
  }
};
