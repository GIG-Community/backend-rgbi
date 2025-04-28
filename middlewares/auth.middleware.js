import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import { JWT_SECRET } from '../config/env.js';

/**
 * Authentication middleware to verify JWT tokens
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get token from header or cookies
    const token = 
      req.headers.authorization?.split(' ')[1] || 
      req.cookies?.token;
    
    if (!token) {
      const error = new Error('Authentication token not provided');
      error.statusCode = 401;
      return next(error);
    }
    
    try {
      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Log token contents for debugging
      console.log('Decoded token:', JSON.stringify(decoded));
      
      // Check if user ID exists in the token
      if (!decoded.userId && !decoded.id) {
        console.log('Token missing userId or id field:', decoded);
        const error = new Error('Invalid token format');
        error.statusCode = 401;
        return next(error);
      }
      
      // Use either userId or id field from token
      const userId = decoded.userId || decoded.id;
      
      // Get user from database
      const user = await User.findById(userId);
      
      if (!user) {
        console.log(`User with ID ${userId} not found in database`);
        const error = new Error('User not found');
        error.statusCode = 401;
        return next(error);
      }
      
      // Set user in request object
      req.isAuthenticated = true;
      req.user = user;
      next();
    } catch (error) {
      console.log('JWT verification error:', error.message);
      
      if (error.name === 'JsonWebTokenError') {
        const err = new Error('Invalid token');
        err.statusCode = 401;
        return next(err);
      }
      
      if (error.name === 'TokenExpiredError') {
        const err = new Error('Token expired');
        err.statusCode = 401;
        return next(err);
      }
      
      next(error);
    }
  } catch (error) {
    console.log('Unexpected error in auth middleware:', error);
    next(error);
  }
};

/**
 * Role-based authorization middleware
 */
export const authorize = (roles = []) => {
  return (req, res, next) => {
    // Check if user is authenticated
    if (!req.isAuthenticated || !req.user) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      return next(error);
    }
    
    // Check if roles array contains user's role
    if (roles.length && !roles.includes(req.user.role)) {
      const error = new Error(`Access denied. Role '${req.user.role}' is not authorized.`);
      error.statusCode = 403;
      return next(error);
    }
    
    next();
  };
};
