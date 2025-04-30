import mongoose from 'mongoose';

// Define schema for trade connections between provinces
const provinceConnectionSchema = new mongoose.Schema({
  sourceProvinceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Province',
    required: true
  },
  targetProvinceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Province',
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Add compound index to prevent duplicate connections for the same source-target-year
provinceConnectionSchema.index(
  { sourceProvinceId: 1, targetProvinceId: 1, year: 1 }, 
  { unique: true }
);

// Add validation to prevent a province from connecting to itself
provinceConnectionSchema.pre('validate', function(next) {
  if (this.sourceProvinceId && this.targetProvinceId && 
      this.sourceProvinceId.toString() === this.targetProvinceId.toString()) {
    this.invalidate('targetProvinceId', 'Source and target provinces cannot be the same');
  }
  next();
});

const ProvinceConnection = mongoose.model('ProvinceConnection', provinceConnectionSchema);

export default ProvinceConnection;
