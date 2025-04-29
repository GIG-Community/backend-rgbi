import mongoose from 'mongoose';
import { getProvinsiList } from '../utils/extractProvince.js';

// Get the same province list used in the user model
const provinsiList = getProvinsiList();

const supplyChainSchema = new mongoose.Schema({
  tahun: {
    type: Number,
    required: [true, 'Year is required']
  },
  provinsi: {
    type: String,
    required: [true, 'Province is required'],
    enum: {
      values: provinsiList,
      message: props => `'${props.value}' is not a valid province. Valid provinces are: ${provinsiList.join(', ')}`
    }
  },
  mpp: {
    type: Number,
    required: [true, 'MPP is required']
  },
  jumlahRantai: {
    type: Number,
    required: [true, 'Chain count is required']
  },
  produksiBeras: {
    type: Number,
    required: [true, 'Rice production is required'],
    comment: 'Dalam Ribu Ton'
  },
  konsumsiBeras: {
    type: Number,
    required: [true, 'Rice consumption is required'],
    comment: 'Dalam Ribu Ton'
  },
  kondisi: {
    type: String,
    enum: ['Surplus', 'Defisit'],
    default: function() {
      return this.produksiBeras <= this.konsumsiBeras ? 'Defisit' : 'Surplus';
    }
  },
  createdBy: {
    type: String,
    required: [true, 'Creator name is required']
  },
  userRole: {
    type: String,
    required: true,
    enum: ['pemerintah', 'petugas_lapangan']
  },
  updatedBy: {
    type: String
  }
}, {
  timestamps: true
});

// Validate and calculate kondisi before saving
supplyChainSchema.pre('save', function(next) {
  if (this.produksiBeras <= this.konsumsiBeras) {
    this.kondisi = 'Defisit';
  } else {
    this.kondisi = 'Surplus';
  }
  next();
});

// Add index to improve query performance
supplyChainSchema.index({ provinsi: 1, tahun: 1 });

const SupplyChain = mongoose.model('SupplyChain', supplyChainSchema);

export default SupplyChain;
