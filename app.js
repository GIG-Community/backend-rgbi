import express from 'express';
import {PORT} from "./config/env.js";
import userRoutes from "./routes/user.routes.js";
import authRoutes from "./routes/auth.routes.js";
import foodSecurityRoutes from "./routes/foodsecurity.routes.js";
import supplyChainRoutes from "./routes/supplychain.routes.js"; 
import connectProvinceRoutes from "./routes/connectprovince.routes.js";
import provinceRoutes from "./routes/province.routes.js"; // Changed from importing the model to the router
import connectToDatabase from "./database/mongodb.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import cookieParser from "cookie-parser";
import mapRoutes from "./routes/map.routes.js"; // Import map routes if needed

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Add this to debug incoming requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/food-securities', foodSecurityRoutes);
app.use('/api/v1/supply-chain', supplyChainRoutes); // Add supply chain routes
app.use('/api/v1/connect-province', connectProvinceRoutes);
app.use('/api/v1/provinces', provinceRoutes); // Fixed to use the router instead of the model
app.use('/api/v1/map', mapRoutes); // Add map routes if needed

// Make sure to use the error middleware
app.use(errorMiddleware);

app.get("/", (req, res) => {
    res.send("Welcome to the backend-rgbi");
});

app.listen(PORT, async ()=>{
    console.log(`Server started on http://localhost:${PORT}`);
    await connectToDatabase();
});

export default app;