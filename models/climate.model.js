import mongoose from 'mongoose';
import { getProvinsiList } from '../utils/extractProvince.js';

const provinsiList = getProvinsiList();

const climateSchema = new mongoose.Schema({
  provinceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Province',
    required: [true, 'Province ID is required']
  },
  bulan: {
    type: Number,
    required: [true, 'Month is required'],
    min: [1, 'Month must be between 1-12'],
    max: [12, 'Month must be between 1-12'],
    validate: {
      validator: function(v) {
        return Number.isInteger(v);
      },
      message: props => `${props.value} is not a valid month. Month must be an integer between 1-12.`
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
    produksi_padi: { 
      type: Number, 
      required: true,
      min: 0,
      comment: 'Produksi padi dalam ribu ton sebagai variabel Y'
    },
  },

  // INDEPENDENT VARIABLES - variabel iklim
  independent_variables: {
    curah_hujan: {
      type: Number,
      required: true,
      min: 0,
      comment: 'Curah hujan dalam milimeter sebagai A1'
    },
    suhu_udara: {
      type: Number,
      required: true,
      min: -50,
      max: 60,
      comment: 'Suhu udara pada ketinggian 2 meter dalam °C sebagai A2'
    },
    radiasi_matahari: { 
      type: Number, 
      required: true,
      min: 0,
      comment: 'Radiasi matahari dalam MJ/m2 sebagai A3'
    },
    kelembaban_udara: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      comment: 'Kelembaban udara relatif pada ketinggian 2 meter dalam persen sebagai A4'
    },
    tutupan_awan: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      comment: 'Tutupan awan dalam persen sebagai A5'
    },
    kecepatan_angin: {
      type: Number,
      required: true,
      min: 0,
      comment: 'Kecepatan angin pada ketinggian 2 meter dalam m/s sebagai A6'
    },
    kelembaban_permukaan_tanah: { 
      type: Number, 
      required: true,
      min: 0,
      comment: 'Kelembaban permukaan tanah dalam kg/m2 sebagai A7'
    },
    kelembaban_zona_akar: { 
      type: Number, 
      required: true,
      min: 0,
      comment: 'Kelembaban zona akar dalam kg/m2 sebagai A8'
    }
  },
  
}, {
  timestamps: true
});

// Add compound index to prevent duplicate records for same province-month-year
climateSchema.index({ provinceId: 1, bulan: 1, tahun: 1 }, { unique: true });
climateSchema.index({ tahun: 1 });
climateSchema.index({ bulan: 1 });

const Climate = mongoose.model('Climate', climateSchema);

export default Climate;
