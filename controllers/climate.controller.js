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

    // Process in batches to avoid memory issues
    const batchSize = 1000; // Process 1000 records at a time
    const batches = [];
    
    for (let i = 0; i < records.length; i += batchSize) {
      batches.push(records.slice(i, i + batchSize));
    }

    let totalCreated = 0;
    const errors = [];

    for (const batch of batches) {
      try {
        const createdBatch = await Climate.insertMany(batch, { 
          ordered: false,
          rawResult: true 
        });
        totalCreated += createdBatch.insertedCount || batch.length;
      } catch (batchError) {
        // Handle duplicate key errors and continue processing
        if (batchError.code === 11000) {
          const duplicateCount = batchError.writeErrors ? batchError.writeErrors.length : 0;
          totalCreated += (batch.length - duplicateCount);
          errors.push(`Batch had ${duplicateCount} duplicates`);
        } else {
          errors.push(`Batch error: ${batchError.message}`);
        }
      }
    }
    
    res.status(201).json({
      success: true,
      message: `${totalCreated} Climate records created successfully from ${records.length} total records`,
      data: {
        totalRecords: records.length,
        successfullyCreated: totalCreated,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to bulk create Climate records',
      error: error.message
    });
  }
};

// New endpoint for streaming large file uploads
export const streamBulkCreateClimate = async (req, res) => {
  try {
    let totalProcessed = 0;
    let totalCreated = 0;
    const batchSize = 500;
    let batch = [];

    req.on('data', (chunk) => {
      try {
        const data = JSON.parse(chunk.toString());
        if (data.records && Array.isArray(data.records)) {
          batch.push(...data.records);
        }
      } catch (parseError) {
        console.error('Error parsing chunk:', parseError);
      }
    });

    req.on('end', async () => {
      try {
        // Process accumulated batch
        if (batch.length > 0) {
          for (let i = 0; i < batch.length; i += batchSize) {
            const currentBatch = batch.slice(i, i + batchSize);
            try {
              const result = await Climate.insertMany(currentBatch, { ordered: false });
              totalCreated += result.length;
            } catch (batchError) {
              if (batchError.code === 11000) {
                const duplicates = batchError.writeErrors ? batchError.writeErrors.length : 0;
                totalCreated += (currentBatch.length - duplicates);
              }
            }
            totalProcessed += currentBatch.length;
          }
        }

        res.status(201).json({
          success: true,
          message: `Processed ${totalProcessed} records, created ${totalCreated} new climate records`,
          data: {
            totalProcessed,
            totalCreated,
            duplicatesSkipped: totalProcessed - totalCreated
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: 'Error processing streamed data',
          error: error.message
        });
      }
    });

    req.on('error', (error) => {
      res.status(400).json({
        success: false,
        message: 'Error receiving streamed data',
        error: error.message
      });
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to process stream upload',
      error: error.message
    });
  }
};
