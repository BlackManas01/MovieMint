// configs/db.js - MongoDB connection using Mongoose
import mongoose from 'mongoose';

// Connects to MongoDB Atlas (or local) using the URI from environment variables
const connectDB = async () => {
    try {
        mongoose.connection.on('connected', () => console.log('Database connected'));
        await mongoose.connect(`${process.env.MONGODB_URI}/moviemint`)
    } catch (error) {
        console.log(error.message);

    }
}

export default connectDB;