import express from 'express';
import {PORT} from "./config/env.js";
import userRoutes from "./routes/user.routes.js";
import authRoutes from "./routes/auth.routes.js";
import foodSecurityRoutes from "./routes/foodsecurity.routes.js";
import connectToDatabase from "./database/mongodb.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import cookieParser from "cookie-parser";

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
// app.use('/api/food-security', foodSecurityRoutes);

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