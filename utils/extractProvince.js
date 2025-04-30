import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getProvinsiList = () => {
  try {
    // Make sure this filename matches exactly what's in your directory
    const geojsonPath = path.join(__dirname, '../province-geojson/province_38.json');
    const geojsonData = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
    
    // Extract province names
    const provinsiList = geojsonData.features.map(feature => feature.properties.PROVINSI);
    return provinsiList;
  } catch (error) {
    console.error('Error loading province name data:', error);
    // Return an empty array or some default values if the file isn't found
    return [];
  }
};

export const getProvinceGeojson = (provinceName = null) => {
  try {
    const geojsonPath = path.join(__dirname, '../province-geojson/province_38.json');
    const geojsonData = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
    
    if (provinceName) {
      // If a province name is provided, return that specific province's geojson
      const province = geojsonData.features.find(
        feature => feature.properties.PROVINSI.toLowerCase() === provinceName.toLowerCase()
      );
      
      if (!province) {
        console.warn(`Province "${provinceName}" not found in geojson data`);
        return null;
      }
      
      return {
        type: "FeatureCollection",
        features: [province]
      };
    }
    
    // If no province name is provided, return all geojson data
    return geojsonData;
  } catch (error) {
    console.error('Error loading province geojson data:', error);
    return null;
  }
};

// Function to get only the geometry/polygon for a specific province
export const getProvincePolygon = (provinceName) => {
  try {
    if (!provinceName) {
      throw new Error('Province name is required');
    }
    
    const geojsonPath = path.join(__dirname, '../province-geojson/province_38.json');
    const geojsonData = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
    
    const province = geojsonData.features.find(
      feature => feature.properties.PROVINSI.toLowerCase() === provinceName.toLowerCase()
    );
    
    if (!province) {
      console.warn(`Province "${provinceName}" not found in geojson data`);
      return null;
    }
    
    return province.geometry;
  } catch (error) {
    console.error('Error extracting province polygon:', error);
    return null;
  }
};