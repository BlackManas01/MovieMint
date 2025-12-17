import { clerkMiddleware } from '@clerk/express';
import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import { serve } from "inngest/express";
import path from "path";
import connectDB from './configs/db.js';
import { stripeWebhooks } from './controllers/stripeWebhooks.js';
import "./cron/expireTickets.js";
import { functions, inngest } from "./inngest/index.js";
import adminRouter from './routes/adminRoutes.js';
import bookingRouter from './routes/bookingRoutes.js';
import router from './routes/seed.js';
import showRouter from './routes/showRoutes.js';
import stripeRoutes from "./routes/stripeRoutes.js";
import userRouter from './routes/userRoutes.js';
import { fileURLToPath } from "url";

const app = express();
const port = 3000;

await connectDB()

// Stripe Webhooks Route
app.use('/api/stripe', express.raw({ type: 'application/json' }), stripeWebhooks)

// Middleware
app.use(express.json())
app.use(cors())
app.use(clerkMiddleware())


// API Routes
app.get('/', (req, res) => res.send('Server is Live!'))
app.use('/api/inngest', serve({ client: inngest, functions }))
app.use('/api/show', showRouter)
app.use("/api/seed", router);
app.use('/api/booking', bookingRouter)
app.use('/api/admin', adminRouter)
app.use('/api/user', userRouter)
app.use("/api/stripe", stripeRoutes);


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));


app.listen(port, () => console.log(`Server listening at http://localhost:${port}`));

