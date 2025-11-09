import mongoose from 'mongoose';

// Define schema for SAR (Social Accounting Matrix Regional)
const sarSchema = new mongoose.Schema({
  mainProvinceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Province',
    required: true
  },
  neighborProvinceIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Province',
    required: true
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Add validation to ensure at least one neighbor province and main province is not in neighbors list
sarSchema.pre('validate', function(next) {
  if (!this.neighborProvinceIds || this.neighborProvinceIds.length === 0) {
    this.invalidate('neighborProvinceIds', 'At least one neighbor province is required');
  }
  
  // Prevent main province from being in its own neighbors list
  if (this.mainProvinceId && this.neighborProvinceIds && 
      this.neighborProvinceIds.some(id => id.toString() === this.mainProvinceId.toString())) {
    this.invalidate('neighborProvinceIds', 'Main province cannot be in its own neighbors list');
  }
  next();
});

const SAR = mongoose.model('SAR', sarSchema);

export default SAR;
