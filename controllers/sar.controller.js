import SAR from '../models/sar.model.js';

// Get all SAR records
export const getAllSAR = async (req, res) => {
  try {
    const sarRecords = await SAR.find()
      .populate('mainProvinceId', 'name')
      .populate('neighborProvinceIds', 'name')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      data: sarRecords
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SAR records',
      error: error.message
    });
  }
};

// Get SAR by ID
export const getSARById = async (req, res) => {
  try {
    const sar = await SAR.findById(req.params.id)
      .populate('mainProvinceId', 'name')
      .populate('neighborProvinceIds', 'name');
    
    if (!sar) {
      return res.status(404).json({
        success: false,
        message: 'SAR record not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: sar
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SAR record',
      error: error.message
    });
  }
};

// Create new SAR record
export const createSAR = async (req, res) => {
  try {
    const { mainProvinceId, neighborProvinceIds } = req.body;
    
    const newSAR = new SAR({
      mainProvinceId,
      neighborProvinceIds
    });
    
    const savedSAR = await newSAR.save();
    
    res.status(201).json({
      success: true,
      message: 'SAR record created successfully',
      data: savedSAR
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to create SAR record',
      error: error.message
    });
  }
};

// Update SAR record
export const updateSAR = async (req, res) => {
  try {
    const updatedSAR = await SAR.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('mainProvinceId', 'name')
     .populate('neighborProvinceIds', 'name');
    
    if (!updatedSAR) {
      return res.status(404).json({
        success: false,
        message: 'SAR record not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'SAR record updated successfully',
      data: updatedSAR
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to update SAR record',
      error: error.message
    });
  }
};

// Delete SAR record
export const deleteSAR = async (req, res) => {
  try {
    const deletedSAR = await SAR.findByIdAndDelete(req.params.id);
    
    if (!deletedSAR) {
      return res.status(404).json({
        success: false,
        message: 'SAR record not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'SAR record deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete SAR record',
      error: error.message
    });
  }
};

// Get SAR by main province
export const getSARByMainProvince = async (req, res) => {
  try {
    const sarRecords = await SAR.find({ mainProvinceId: req.params.provinceId })
      .populate('mainProvinceId', 'name')
      .populate('neighborProvinceIds', 'name');
    
    res.status(200).json({
      success: true,
      data: sarRecords
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SAR records by main province',
      error: error.message
    });
  }
};

// Bulk create SAR records
export const bulkCreateSAR = async (req, res) => {
  try {
    const { records } = req.body;
    
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Records array is required and cannot be empty'
      });
    }
    
    const createdSAR = await SAR.insertMany(records, { ordered: false });
    
    res.status(201).json({
      success: true,
      message: `${createdSAR.length} SAR records created successfully`,
      data: createdSAR
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to bulk create SAR records',
      error: error.message
    });
  }
};
