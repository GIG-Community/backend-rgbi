import mongoose from 'mongoose';
import { getProvinsiList } from '../utils/extractProvince.js';

const provinsiList = getProvinsiList();

// Custom email validator that explicitly checks for spaces
const validateEmail = function(email) {
  // Basic regex that disallows spaces
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minLength: 2,
    maxLength: 50,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    validate: [
      {
        validator: validateEmail,
        message: 'Please enter a valid email address without spaces'
      }
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minLength: [6, 'Password must be at least 6 characters'],
  },
  role: {
    type: String,
    required: [true, 'Role is required'],
    enum: ['masyarakat', 'pemerintah', 'petugas_lapangan'],
    default: 'masyarakat'
  },
  provinsi: {
    type: String,
    enum: {
      values: provinsiList,
      message: props => `'${props.value}' is not a valid province. Valid provinces are: ${provinsiList.join(', ')}`
    },
    validate: {
      validator: function(v) {
        // Only required for petugas_lapangan and pemerintah roles
        if (this.role === 'petugas_lapangan' || this.role === 'pemerintah') {
          return v != null && v.trim() !== '';
        }
        return true; // Not required for other roles
      },
      message: 'Provinsi is required for petugas_lapangan and pemerintah roles'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware to validate provinsi requirement based on role
userSchema.pre('save', function(next) {
  if ((this.role === 'petugas_lapangan' || this.role === 'pemerintah') && 
      (!this.provinsi || this.provinsi.trim() === '')) {
    const err = new Error('Provinsi is required for petugas_lapangan and pemerintah roles');
    return next(err);
  }
  next();
});

// Middleware to validate email format before saving
userSchema.pre('save', function(next) {
  // If email contains spaces after trimming or other invalid characters
  if (this.email && !validateEmail(this.email)) {
    const err = new Error('Email format is invalid. No spaces allowed.');
    return next(err);
  }
  next();
});

const User = mongoose.model('User', userSchema);

export default User;