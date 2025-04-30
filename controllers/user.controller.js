import User from '../models/user.model.js';
import Province from '../models/province.model.js';
import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler.js';

// Get all users with their province info
export const getAllUsers = asyncHandler(async (req, res) => {
  // Find all users
  const users = await User.find({});
  
  // Populate province info for each user
  const usersWithProvinceInfo = await Promise.all(
    users.map(async (user) => {
      const provinceInfo = await user.getProvinceInfo();
      return {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        province: provinceInfo
      };
    })
  );
  
  res.status(200).json({
    success: true,
    count: usersWithProvinceInfo.length,
    data: usersWithProvinceInfo
  });
});

// Get user by ID with province info
export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  // Get province info
  const provinceInfo = await user.getProvinceInfo();
  
  res.status(200).json({
    success: true,
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      province: provinceInfo
    }
  });
});

// Create new user with province reference
export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, provinceId } = req.body;
  
  // Validate province ID exists
  if (!provinceId || !mongoose.Types.ObjectId.isValid(provinceId)) {
    return res.status(400).json({
      success: false,
      message: 'Valid province ID is required'
    });
  }

  // Verify province exists in database
  const province = await Province.findById(provinceId);
  if (!province) {
    return res.status(404).json({
      success: false,
      message: 'Province not found'
    });
  }
  
  // Create user with province reference
  const user = await User.create({
    name,
    email,
    password,
    role,
    provinceId
  });
  
  // Get province info for response
  const provinceInfo = await user.getProvinceInfo();
  
  res.status(201).json({
    success: true,
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      province: provinceInfo
    }
  });
});

// Update user with province reference
export const updateUser = asyncHandler(async (req, res) => {
  const { provinceId } = req.body;
  
  // If provinceId is being updated, verify it exists
  if (provinceId) {
    if (!mongoose.Types.ObjectId.isValid(provinceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid province ID format'
      });
    }
    
    // Verify province exists in database
    const province = await Province.findById(provinceId);
    if (!province) {
      return res.status(404).json({
        success: false,
        message: 'Province not found'
      });
    }
  }
  
  const user = await User.findByIdAndUpdate(
    req.params.id, 
    req.body, 
    { new: true, runValidators: true }
  );
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  // Get updated province info
  const provinceInfo = await user.getProvinceInfo();
  
  res.status(200).json({
    success: true,
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      province: provinceInfo
    }
  });
});

// Delete user
export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  res.status(200).json({
    success: true,
    message: 'User deleted successfully'
  });
});

// Get users by province
export const getUsersByProvince = asyncHandler(async (req, res) => {
  const { provinceId } = req.params;
  
  // Validate province ID format
  if (!mongoose.Types.ObjectId.isValid(provinceId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid province ID format'
    });
  }
  
  // Verify province exists
  const province = await Province.findById(provinceId);
  if (!province) {
    return res.status(404).json({
      success: false,
      message: 'Province not found'
    });
  }
  
  // Find users by province ID
  const users = await User.find({ provinceId });
  
  const usersData = users.map(user => ({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role
  }));
  
  res.status(200).json({
    success: true,
    province: {
      id: province._id,
      name: province.name,
      code: province.code
    },
    count: users.length,
    data: usersData
  });
});
