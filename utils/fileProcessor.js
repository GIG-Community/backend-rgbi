import fs from 'fs';
import path from 'path';
import Climate from '../models/climate.model.js';

export const processLargeClimateFile = async (filePath, batchSize = 1000) => {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    
    if (!data.records || !Array.isArray(data.records)) {
      throw new Error('Invalid file format. Expected { records: [] }');
    }

    const records = data.records;
    let totalCreated = 0;
    const errors = [];

    // Process in batches
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      try {
        const result = await Climate.insertMany(batch, { 
          ordered: false,
          rawResult: true 
        });
        totalCreated += result.insertedCount || batch.length;
        
        console.log(`Processed batch ${Math.floor(i/batchSize) + 1}: ${batch.length} records`);
      } catch (batchError) {
        if (batchError.code === 11000) {
          // Handle duplicates
          const duplicateCount = batchError.writeErrors ? batchError.writeErrors.length : 0;
          totalCreated += (batch.length - duplicateCount);
          console.log(`Batch ${Math.floor(i/batchSize) + 1}: ${duplicateCount} duplicates skipped`);
        } else {
          errors.push(`Batch ${Math.floor(i/batchSize) + 1}: ${batchError.message}`);
        }
      }
    }

    return {
      totalRecords: records.length,
      successfullyCreated: totalCreated,
      errors
    };

  } catch (error) {
    throw new Error(`File processing failed: ${error.message}`);
  }
};

export const validateClimateData = (record) => {
  const required = ['provinceId', 'bulan', 'tahun', 'dependent_variable', 'independent_variables'];
  
  for (const field of required) {
    if (!record[field]) {
      return `Missing required field: ${field}`;
    }
  }
  
  if (!record.dependent_variable.produksi_padi) {
    return 'Missing produksi_padi in dependent_variable';
  }
  
  const climateVars = [
    'curah_hujan', 'suhu_udara', 'radiasi_matahari', 
    'kelembaban_udara', 'tutupan_awan', 'kecepatan_angin',
    'kelembaban_permukaan_tanah', 'kelembaban_zona_akar'
  ];
  
  for (const variable of climateVars) {
    if (record.independent_variables[variable] === undefined) {
      return `Missing ${variable} in independent_variables`;
    }
  }
  
  return null; // Valid
};
