import mongoose from 'mongoose';

// Define schema for Margin Perdagangan dan Pengangkutan (MPP)
const mppSchema = new mongoose.Schema({
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
  distribution_costs: {
    type: Number,
    required: true,
    min: 0
  },
  distribution_volume: {
    type: Number,
    required: true,
    min: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Add compound index to prevent duplicate connections for the same source-target pair
mppSchema.index(
  { sourceProvinceId: 1, targetProvinceId: 1 }, 
  { unique: true }
);

// Add validation to prevent a province from connecting to itself
mppSchema.pre('validate', function(next) {
  if (this.sourceProvinceId && this.targetProvinceId && 
      this.sourceProvinceId.toString() === this.targetProvinceId.toString()) {
    this.invalidate('targetProvinceId', 'Source and target provinces cannot be the same');
  }
  next();
});

const MPP = mongoose.model('MPP', mppSchema);

export default MPP;
