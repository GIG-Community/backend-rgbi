import mongoose from 'mongoose';
import { getProvinsiList } from '../utils/extractProvince.js';

const provinsiList = getProvinsiList();

const gwprSchema = new mongoose.Schema({
  kelompok: {
    type: Number,
    required: [true, 'Kelompok is required'],
    min: [1, 'Kelompok must be at least 1']
  },
  provinceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'Province ID is required'],
    ref: 'Province'
  },
  // Ubah dari tahun spesifik ke periode
  periode_analisis: {
    tahun_mulai: {
      type: Number,
      required: true,
      default: 2018
    },
    tahun_selesai: {
      type: Number,
      required: true,
      default: 2023
    }
  },
  
  // Significant variables using actual field names from food security model
  variabel_signifikan: [{
    type: String,
    enum: [
      'persentase_nilai_perdagangan_domestik',
      'indeks_harga_implisit',
      'koefisien_gini',
      'indeks_pembangunan_manusia',
      'kepadatan_penduduk',
      'ketersediaan_infrastruktur_jalan',
      'indeks_kemahalan_konstruksi',
      'indeks_demokrasi_indonesia'
    ],
    required: true
  }],
  
  // Optional: Regression coefficients (for analysis results, not input)
  koefisien_regresi: {
    persentase_nilai_perdagangan_domestik: { type: Number },
    indeks_harga_implisit: { type: Number },
    koefisien_gini: { type: Number },
    indeks_pembangunan_manusia: { type: Number },
    kepadatan_penduduk: { type: Number },
    ketersediaan_infrastruktur_jalan: { type: Number },
    indeks_kemahalan_konstruksi: { type: Number },
    indeks_demokrasi_indonesia: { type: Number }
  },
  
  // Optional: Model quality metrics (for analysis results)
  r_squared: {
    type: Number,
    min: 0,
    max: 1,
    comment: 'Coefficient of determination'
  },
  adjusted_r_squared: {
    type: Number,
    min: 0,
    max: 1,
    comment: 'Adjusted R-squared'
  },
  
  // Optional: Geographic weight information
  bandwidth: {
    type: Number,
    min: 0,
    comment: 'Geographic bandwidth used in GWPR'
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
  }
});

// Add indexes for better query performance - fix the unique index
gwprSchema.index({ provinceId: 1, kelompok: 1 }, { unique: true });
gwprSchema.index({ kelompok: 1 });
gwprSchema.index({ 'variabel_signifikan': 1 });

const GWPR = mongoose.model('GWPR', gwprSchema);

export default GWPR;
