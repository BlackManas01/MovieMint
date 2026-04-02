// middleware/auth.js - Authentication and authorization middleware
import { clerkClient } from "@clerk/express";

// Middleware: verifies the user has admin role in Clerk's privateMetadata
export const protectAdmin = async (req, res, next) => {
    try {
        const { userId } = req.auth();

        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const user = await clerkClient.users.getUser(userId)

        if (user.privateMetadata.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Not authorized" })
        }

        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: "Not authorized" });
    }
}