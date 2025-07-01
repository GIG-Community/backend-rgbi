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

  // FOOD SECURITY CATEGORY
  kategori_ketahanan_pangan: {
    kategori: {
      type: Number,
      min: 1,
      max: 6
    },
    label: {
      type: String,
      enum: ['Sangat Rentan', 'Rentan', 'Agak Rentan', 'Agak Tahan', 'Tahan', 'Sangat Tahan', 'Tidak Valid']
    },
    deskripsi: {
      type: String
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
    harga_komoditas_beras: { 
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
    persentase_rumah_tangga_dengan_listrik: { 
      type: Number, 
      required: true,
      min: 0,
      max: 100,
      comment: 'Persen rumah tangga dengan akses listrik (%)'
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
foodSecuritySchema.index({ 'kategori_ketahanan_pangan.kategori': 1 });
foodSecuritySchema.index({ tahun: 1 });

// Method to determine food security category
foodSecuritySchema.methods.determineFoodSecurityCategory = function() {
  const indeks = this.dependent_variable.indeks_ketahanan_pangan;
  
  if (indeks <= 37.61) {
    return {
      kategori: 1,
      label: 'Sangat Rentan',
      deskripsi: 'Prioritas 1 (Sangat Rentan)'
    };
  } else if (indeks > 37.61 && indeks <= 48.27) {
    return {
      kategori: 2,
      label: 'Rentan',
      deskripsi: 'Prioritas 2 (Rentan)'
    };
  } else if (indeks > 48.27 && indeks <= 57.11) {
    return {
      kategori: 3,
      label: 'Agak Rentan',
      deskripsi: 'Prioritas 3 (Agak Rentan)'
    };
  } else if (indeks > 57.11 && indeks <= 65.96) {
    return {
      kategori: 4,
      label: 'Agak Tahan',
      deskripsi: 'Prioritas 4 (Agak Tahan)'
    };
  } else if (indeks > 65.96 && indeks <= 74.40) {
    return {
      kategori: 5,
      label: 'Tahan',
      deskripsi: 'Prioritas 5 (Tahan)'
    };
  } else if (indeks > 74.40) {
    return {
      kategori: 6,
      label: 'Sangat Tahan',
      deskripsi: 'Prioritas 6 (Sangat Tahan)'
    };
  } else {
    return {
      kategori: null,
      label: 'Tidak Valid',
      deskripsi: 'Indeks tidak valid'
    };
  }
};

// Pre-save hook to automatically set category
foodSecuritySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Auto-determine category if not set
  if (!this.kategori_ketahanan_pangan || !this.kategori_ketahanan_pangan.kategori) {
    this.kategori_ketahanan_pangan = this.determineFoodSecurityCategory();
  }
  
  next();
});

const FoodSecurity = mongoose.model('FoodSecurity', foodSecuritySchema);

export default FoodSecurity;