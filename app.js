import express from 'express';
import cors from 'cors';
import {PORT} from "./config/env.js";
import userRoutes from "./routes/user.routes.js";
import authRoutes from "./routes/auth.routes.js";
import foodSecurityRoutes from "./routes/foodsecurity.routes.js";
import supplyChainRoutes from "./routes/supplychain.routes.js"; 
import connectProvinceRoutes from "./routes/connectprovince.routes.js";
import provinceRoutes from "./routes/province.routes.js"; // Changed from importing the model to the router
import connectToDatabase from "./database/mongodb.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import clusterRouter from './routes/clustering.routes.js';
import cookieParser from "cookie-parser";
import mapRoutes from './routes/map.routes.js';
import gwprRouter from './routes/gwpr.routes.js';
import sarRouter from './routes/sar.routes.js';
import climateRouter from './routes/climate.routes.js';
import mppRouter from './routes/mpp.routes.js';

const app = express();

// Add CORS middleware before other middleware
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:3001',
    'https://pangan-id.com',
    'https://www.pangan-id.com',
    'http://pangan-id.com',
    'http://www.pangan-id.com'
  ], // Add your frontend URLs
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Increase body parser limits for large bulk uploads
app.use(express.json({ 
  limit: '50mb',  // Increase from default 100kb to 50mb
  extended: true 
}));
app.use(express.urlencoded({ 
  limit: '50mb', 
  extended: true 
}));
app.use(cookieParser());

// Add this to debug incoming requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/food-securities', foodSecurityRoutes);
app.use('/api/v1/supply-chain', supplyChainRoutes); // Add supply chain routes
app.use('/api/v1/connect-province', connectProvinceRoutes);
app.use('/api/v1/provinces', provinceRoutes); // Fixed to use the router instead of the model
app.use('/api/v1/map', mapRoutes);
app.use('/api/v1/clustering', clusterRouter);
app.use('/api/v1/gwpr', gwprRouter);
app.use('/api/v1/sar', sarRouter);
app.use('/api/v1/climate', climateRouter);
app.use('/api/v1/mpp', mppRouter);

// Add a catch-all error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message
  });
});

// Make sure to use the error middleware
app.use(errorMiddleware);

app.get("/", (req, res) => {
    res.send("Welcome to the backend-rgbi");
});

app.listen(PORT, async ()=>{
    console.log(`Server started on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`CORS allowed origins: ${process.env.NODE_ENV === 'production' ? 'pangan-id.com domains' : 'localhost domains'}`);
    await connectToDatabase();
});

export default app;