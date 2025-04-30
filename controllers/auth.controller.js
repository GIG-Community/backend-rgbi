import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_EXPIRES_IN, JWT_SECRET } from "../config/env.js";
import User from "../models/user.model.js";
import Province from "../models/province.model.js";
import asyncHandler from "../utils/asyncHandler.js";

// Sign up controller
export const signUp = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, email, password, role, provinceId } = req.body;

    // Validate province ID exists
    if (!provinceId || !mongoose.Types.ObjectId.isValid(provinceId)) {
      return res.status(400).json({
        success: false,
        message: "Valid province ID is required",
      });
    }

    // Verify province exists in database
    const province = await Province.findById(provinceId);
    if (!province) {
      return res.status(404).json({
        success: false,
        message: "Province not found",
      });
    }

    // Create user with province reference
    const user = await User.create({
      name,
      email,
      password,
      role,
      provinceId, // Store the province ID reference
    });

    // Get token
    const token = user.getJwtToken();

    // Include province info in response
    const provinceInfo = await user.getProvinceInfo();

    res.status(201).json({
      success: true,
      token,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          province: provinceInfo,
        },
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    // Handle duplicate email
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Sign in controller
export const signIn = asyncHandler(async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if email and password exist
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Find user and include province data
    const user = await User.findOne({ email }).select("+password");

    // Check if user exists
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if password is correct
    const isPasswordCorrect = await user.correctPassword(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Get province info
    const provinceInfo = await user.getProvinceInfo();

    // Get token
    const token = user.getJwtToken();

    res.status(200).json({
      success: true,
      token,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          province: provinceInfo,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Sign out controller
export const signOut = async (req, res, next) => {
  // Since JWT is stateless, we just return success
  // In a real implementation, you might blacklist the token or handle cookie clearing
  res.status(200).json({
    success: true,
    message: "User successfully signed out",
  });
};