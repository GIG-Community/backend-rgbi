import MPP from '../models/mpp.model.js';

// Get all MPP records
export const getAllMPP = async (req, res) => {
  try {
    const mppRecords = await MPP.find()
      .populate('sourceProvinceId', 'name')
      .populate('targetProvinceId', 'name')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      data: mppRecords
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch MPP records',
      error: error.message
    });
  }
};

// Get MPP by ID
export const getMPPById = async (req, res) => {
  try {
    const mpp = await MPP.findById(req.params.id)
      .populate('sourceProvinceId', 'name')
      .populate('targetProvinceId', 'name');
    
    if (!mpp) {
      return res.status(404).json({
        success: false,
        message: 'MPP record not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: mpp
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch MPP record',
      error: error.message
    });
  }
};

// Create new MPP record
export const createMPP = async (req, res) => {
  try {
    const { sourceProvinceId, targetProvinceId, distribution_costs } = req.body;
    
    const newMPP = new MPP({
      sourceProvinceId,
      targetProvinceId,
      distribution_costs
    });
    
    const savedMPP = await newMPP.save();
    
    res.status(201).json({
      success: true,
      message: 'MPP record created successfully',
      data: savedMPP
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Connection between these provinces already exists'
      });
    }
    
    res.status(400).json({
      success: false,
      message: 'Failed to create MPP record',
      error: error.message
    });
  }
};

// Update MPP record
export const updateMPP = async (req, res) => {
  try {
    const updatedMPP = await MPP.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('sourceProvinceId', 'name')
     .populate('targetProvinceId', 'name');
    
    if (!updatedMPP) {
      return res.status(404).json({
        success: false,
        message: 'MPP record not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'MPP record updated successfully',
      data: updatedMPP
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to update MPP record',
      error: error.message
    });
  }
};

// Delete MPP record
export const deleteMPP = async (req, res) => {
  try {
    const deletedMPP = await MPP.findByIdAndDelete(req.params.id);
    
    if (!deletedMPP) {
      return res.status(404).json({
        success: false,
        message: 'MPP record not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'MPP record deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete MPP record',
      error: error.message
    });
  }
};

// Get MPP by source province
export const getMPPBySourceProvince = async (req, res) => {
  try {
    const mppRecords = await MPP.find({ sourceProvinceId: req.params.provinceId })
      .populate('sourceProvinceId', 'name')
      .populate('targetProvinceId', 'name');
    
    res.status(200).json({
      success: true,
      data: mppRecords
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch MPP records by source province',
      error: error.message
    });
  }
};

// Bulk create MPP records
export const bulkCreateMPP = async (req, res) => {
  try {
    const { records } = req.body;
    
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Records array is required and cannot be empty'
      });
    }
    
    const createdMPP = await MPP.insertMany(records, { ordered: false });
    
    res.status(201).json({
      success: true,
      message: `${createdMPP.length} MPP records created successfully`,
      data: createdMPP
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Some connections between provinces already exist',
        error: error.message
      });
    }
    
    res.status(400).json({
      success: false,
      message: 'Failed to bulk create MPP records',
      error: error.message
    });
  }
};
