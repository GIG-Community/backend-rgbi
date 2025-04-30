import mongoose from 'mongoose';
import { getProvinsiList } from '../utils/extractProvince.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const provinsiList = getProvinsiList();

// Custom email validator that explicitly checks for spaces
const validateEmail = function(email) {
  // Basic regex that disallows spaces and validates email format
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
    required: false
  },
  provinceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Province',
    validate: {
      validator: function(v) {
        // Only required for petugas_lapangan and pemerintah roles
        if (this.role === 'petugas_lapangan' || this.role === 'pemerintah') {
          return mongoose.Types.ObjectId.isValid(v);
        }
        return true; // Not required for other roles
      },
      message: 'Valid province ID is required for petugas_lapangan and pemerintah roles'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware to validate provinceId requirement based on role
userSchema.pre('save', function(next) {
  if ((this.role === 'petugas_lapangan' || this.role === 'pemerintah') && 
      !this.provinceId) {
    const err = new Error('Province ID is required for petugas_lapangan and pemerintah roles');
    return next(err);
  }
  next();
});

// Add middleware to auto-populate provinsi field from provinceId if needed
userSchema.pre('save', async function(next) {
  try {
    // If provinceId is provided but provinsi is not set
    if (this.provinceId && (!this.provinsi || this.provinsi.trim() === '')) {
      const Province = mongoose.model('Province');
      const province = await Province.findById(this.provinceId);
      
      if (province) {
        this.provinsi = province.name;
      }
    }
    next();
  } catch (error) {
    next(error);
  }
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

// Hash the password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Generate a salt
    const salt = await bcrypt.genSalt(10);
    // Hash the password along with the new salt
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check if password matches
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Generate JWT token
userSchema.methods.getJwtToken = function() {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET || 'your-default-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
};

// Enhance getProvinceInfo to return more details
userSchema.methods.getProvinceInfo = async function() {
  try {
    if (!this.provinceId) {
      return null;
    }
    
    const Province = mongoose.model('Province');
    return await Province.findById(this.provinceId, 'name code');
  } catch (error) {
    console.error('Error fetching province info:', error);
    return null;
  }
};

const User = mongoose.model('User', userSchema);

export default User;