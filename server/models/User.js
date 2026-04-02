// models/User.js - User schema (synced from Clerk via webhooks)
import mongoose from "mongoose";

// Stores basic user info; _id is the Clerk user ID (string)
const userSchema = new mongoose.Schema({
    _id: {type: String, required: true},       // Clerk user ID
    name: {type: String, required: true},       // Full name from Clerk
    email: {type: String, required: true},      // Primary email
    image: {type: String, required: true}       // Profile image URL
})

const User = mongoose.model('User', userSchema)

export default User;