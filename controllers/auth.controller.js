import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {JWT_EXPIRES_IN, JWT_SECRET} from "../config/env.js";
import User from "../models/user.model.js";

export const signUp = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try{
        const {name, email, password, role, provinsi} = req.body; // Changed from nama to name

        const existingUser = await User.findOne({email});
        if (existingUser) {
            const error = new Error('User already exists');
            error.statusCode = 409;
            throw error;
        }
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userData = {
            name, // Changed from nama to name
            email, 
            password: hashedPassword,
            role: role || 'masyarakat'
        };

        // Add provinsi if provided or if required by role
        if (provinsi) {
            userData.provinsi = provinsi;
        }

        const newUser = await User.create([userData], {session});
        const token = jwt.sign({userId: newUser[0]._id}, JWT_SECRET, {expiresIn: JWT_EXPIRES_IN});

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            success: true,
            message: 'User successfully signed up',
            data: {
                token,
                user: newUser[0]
            },
        });
    }
    catch(error){
        await session.abortTransaction();
        session.endSession();
        next(error);
    }
}

// Rest of the controller methods remain the same...
export const signIn = async (req, res, next) => {
    try {
        const {email, password} = req.body;

        // Find user by email
        const user = await User.findOne({email});
        if (!user) {
            const error = new Error('Invalid credentials');
            error.statusCode = 401;
            throw error;
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            const error = new Error('Invalid credentials');
            error.statusCode = 401;
            throw error;
        }

        // Record login timestamp
        const loginTime = new Date();
        
        // Optional: Update user's lastLogin field if you have one
        // user.lastLogin = loginTime;
        // await user.save();

        // Generate token
        const token = jwt.sign({userId: user._id}, JWT_SECRET, {expiresIn: JWT_EXPIRES_IN});

        res.status(200).json({
            success: true,
            message: 'User successfully signed in',
            data: {
                token,
                user,
                loginDetails: {
                    timestamp: loginTime,
                    formattedTime: loginTime.toLocaleString('id-ID', {
                        timeZone: 'Asia/Jakarta',
                        dateStyle: 'full',
                        timeStyle: 'medium'
                    })
                }
            }
        });
    } catch (error) {
        next(error);
    }
}

export const signOut = async (req, res, next) => {
    // Since JWT is stateless, we just return success
    // In a real implementation, you might blacklist the token or handle cookie clearing
    res.status(200).json({
        success: true,
        message: 'User successfully signed out'
    });
}