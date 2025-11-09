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
    prevalence_of_undernourishment: { 
      type: Number, 
      required: true,
      min: 0,
      max: 100,
      comment: 'variabel Y'
    },
  },



  // UPDATED INDEPENDENT VARIABLES - berdasarkan data baru
  independent_variables: {
    persentase_nilai_perdagangan_domestik: {
      type: Number,
      required: true,
      min: 0,
      max: 10000,
      comment: '(Nilai Pembelian+Nilai Penjualan)/PDRB ADHB Persen (%) sebagai X1'
    },
    indeks_harga_implisit: {
      type: Number,
      required: true,
      min: 0,
      max: 10000,
      comment: 'Indeks Harga Implisit PDRB sebagai X2'
    },
    koefisien_gini: { 
      type: Number, 
      required: true,
      min: 0,
      max: 1,
      comment: 'Koefisien Gini sebagai X3'
    },
    indeks_pembangunan_manusia: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      comment: 'Indeks Pembangunan Manusia sebagai X4'
    },
    kepadatan_penduduk: {
      type: Number,
      required: true,
      min: 0,
      max: 100000,
      comment: 'Jiwa per km² sebagai X5'
    },
    ketersediaan_infrastruktur_jalan: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      comment: 'ketersidaan infrastruktur jalan sebagai X6, panjang jalan / jumlah penduduk'
    },
    indeks_kemahalan_konstruksi: { 
      type: Number, 
      required: true,
      min: 0,
      max: 1000,
      comment: 'Indeks Kemahalan Konstruksi sebagai X7'
    },
    indeks_demokrasi_indonesia: { 
      type: Number, 
      required: true,
      min: 0,
      max: 100,
      comment: 'Indeks Demokrasi Indonesia (IDI) sebagai X8'
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
// foodSecuritySchema.index({ 'kategori_ketahanan_pangan.kategori': 1 });
foodSecuritySchema.index({ tahun: 1 });

const FoodSecurity = mongoose.model('FoodSecurity', foodSecuritySchema);

export default FoodSecurity;