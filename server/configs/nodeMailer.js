// configs/nodeMailer.js - Email transporter using Brevo (Sendinblue) SMTP
import nodemailer from 'nodemailer';

// Create reusable SMTP transporter with Brevo relay credentials
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Sends an HTML email using the configured transporter
const sendEmail = async ({ to, subject, body })=>{
    const response = await transporter.sendMail({
        from: process.env.SENDER_EMAIL,
        to,
        subject,
        html: body,
    })
    return response
}

export default sendEmail;