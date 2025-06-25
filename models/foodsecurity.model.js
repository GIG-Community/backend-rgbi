import mongoose from 'mongoose';
import { getProvinsiList } from '../utils/extractProvince.js';

const provinsiList = getProvinsiList();

const foodSecuritySchema = new mongoose.Schema({
  provinsi: {
    type: String,
    required: [true, 'Province name is required'],
    enum: {
      values: provinsiList,
      message: props => `'${props.value}' is not a valid province. Valid provinces are: ${provinsiList.join(', ')}`
    }
  },
  tahun: {
    type: Number,
    required: [true, 'Year is required'],
    min: [2000, 'Year must be 2000 or later'],
    max: [2100, 'Year cannot be beyond 2100'],
    validate: {
      validator: function(v) {
        return Number.isInteger(v);
      },
      message: props => `${props.value} is not a valid year. Year must be an integer.`
    }
  },
  
  // DEPENDENT VARIABLE
  dependent_variable: {
    indeks_ketahanan_pangan: { 
      type: Number, 
      required: true,
      min: 0,
      max: 100
    }
  },

  // UPDATED INDEPENDENT VARIABLES - berdasarkan data baru
  independent_variables: {
    produktivitas_padi: { 
      type: Number, 
      required: true,
      comment: 'Kuintal/hektar'
    },
    persentase_penduduk_miskin: { 
      type: Number, 
      required: true,
      min: 0,
      max: 100,
      comment: 'Persen (%)'
    },
    harga_komdistas_beras: { 
      type: Number, 
      required: true,
      comment: 'Rupiah per kilogram'
    },
    persentase_pengeluaran_makanan: { 
      type: Number, 
      required: true,
      min: 0,
      max: 100,
      comment: 'Persen pengeluaran per kapita sebulan untuk makanan (%)'
    },
    prevalensi_balita_stunting: { 
      type: Number, 
      required: true,
      min: 0,
      max: 100,
      comment: 'Persen (%)'
    },
    ipm: { 
      type: Number, 
      required: true,
      min: 0,
      max: 100,
      comment: 'Indeks Pembangunan Manusia'
    },
    kepadatan_penduduk: { 
      type: Number, 
      required: true,
      min: 0,
      comment: 'Jiwa per km²'
    },
    ahh: { 
      type: Number, 
      required: true,
      min: 0,
      comment: 'Angka Harapan Hidup (tahun)'
    },
    persentase_rumah_tangga_tanpa_listrik: { 
      type: Number, 
      required: true,
      min: 0,
      max: 100,
      comment: 'Persen rumah tangga tanpa akses listrik (%)'
    }
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: String,
    default: 'system'
  },
  userRole: {
    type: String,
    default: 'system'
  },
  updatedBy: {
    type: String
  }
});

// Add index to improve query performance
foodSecuritySchema.index({ provinsi: 1, tahun: 1 }, { unique: true });

// Update the updatedAt timestamp on save
foodSecuritySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const FoodSecurity = mongoose.model('FoodSecurity', foodSecuritySchema);

export default FoodSecurity;