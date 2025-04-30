import mongoose from 'mongoose';
import { getProvinsiList, getProvinceGeojson, getProvincePolygon } from '../utils/extractProvince.js';

// Main Province Schema
const provinceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  code: {
    type: String,
    trim: true
  },
  // Store GeoJSON data for visualization
  geoData: {
    type: Object
  },
  // Additional metadata about the province
  metadata: {
    population: Number,
    gdp: Number,
    area: Number,
    capitalCity: String,
    // Add other relevant data as needed
  }
}, {
  timestamps: true
});

// Method to get geojson data for this province
provinceSchema.methods.getGeojson = function() {
  if (this.geoData) {
    return this.geoData;
  }
  
  // If not stored, fetch from utility
  return getProvinceGeojson(this.name);
};

// Method to get polygon data for this province
provinceSchema.methods.getPolygon = function() {
  if (this.geoData && this.geoData.geometry) {
    return this.geoData.geometry;
  }
  
  // If not stored, fetch from utility
  return getProvincePolygon(this.name);
};

// Static method to initialize provinces from GeoJSON data
provinceSchema.statics.initializeFromGeoJSON = async function() {
  const provinceNames = getProvinsiList();
  const existingProvinces = await this.find({}, 'name');
  const existingNames = existingProvinces.map(p => p.name);
  
  for (const name of provinceNames) {
    if (!existingNames.includes(name)) {
      const geojson = getProvinceGeojson(name);
      const code = geojson && geojson.features && geojson.features[0] ? 
        geojson.features[0].properties.KODE_PROV : null;
      
      await this.create({
        name,
        code,
        geoData: geojson && geojson.features ? geojson.features[0] : null
      });
    }
  }
  
  return await this.find();
};

const Province = mongoose.model('Province', provinceSchema);

export default Province;
