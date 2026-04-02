// server.js - Express server entry point
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
import userRouter from './routes/userRoutes.js';
import { fileURLToPath } from "url";

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Validate required environment variables at startup (fail fast if missing)
const requiredEnvVars = ['MONGODB_URI', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SMTP_USER', 'SMTP_PASS', 'SENDER_EMAIL', 'CLIENT_URL'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}

await connectDB()

// Stripe Webhooks Route (must be before express.json())
app.use('/api/stripe', express.raw({ type: 'application/json' }), stripeWebhooks)

// Middleware
app.use(express.json({ limit: '10kb' }))
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }))
app.use(clerkMiddleware())


// API Routes
app.get('/', (req, res) => res.send('Server is Live!'))
app.use('/api/inngest', serve({ client: inngest, functions }))
app.use('/api/show', showRouter)
app.use("/api/seed", router);
app.use('/api/booking', bookingRouter)
app.use('/api/admin', adminRouter)
app.use('/api/user', userRouter)


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

app.listen(port, () => console.log(`Server listening at http://localhost:${port}`));

