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