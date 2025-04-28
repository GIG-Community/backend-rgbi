import mongoose from 'mongoose';
import { getProvinsiList } from '../utils/extractProvince.js';

// Get the same province list used in the user model
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

  // INDEPENDENT VARIABLES
  independent_variables: {
    ketersediaan: {
      produksi_padi: { type: Number, required: true }, // ton
      luas_panen_padi: { type: Number, required: true }, // hektar
      produktivitas_padi: { type: Number, required: true } // kuintal/hektar
    },
    aksesibilitas: {
      pendapatan_per_kapita: { type: Number, required: true }, // Rupiah
      persentase_penduduk_miskin: { type: Number, required: true }, // %
      harga_beras: { type: Number, required: true } // Rp/kg
    },
    pemanfaatan: {
      pengeluaran_makanan: { type: Number, required: true }, // %
      prevalence_of_undernourishment: { type: Number, required: true }, // %
      food_security_experience_scale: { type: Number, required: true }, // skala
      akses_air_minum: { type: Number, required: true }, // %
      akses_sanitasi: { type: Number, required: true } // %
    },
    stabilitas: {
      ketidakcukupan_konsumsi_pangan: { type: Number, required: true }, // %
      penerima_bansos: { type: Number, required: true } // orang
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