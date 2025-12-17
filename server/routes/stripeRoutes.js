import express from "express";
import { createCheckoutSession } from "../controllers/stripeController.js";

const stripeRouter = express.Router();

// Create Stripe Checkout Session
stripeRouter.get("/create-checkout-session", createCheckoutSession);

export default stripeRouter;
