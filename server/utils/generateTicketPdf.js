// utils/generateTicketPdf.js - Generates a branded PDF ticket with QR code for confirmed bookings
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";

// Creates a PDF ticket for the given booking and saves it to /uploads/tickets/
// Returns { url, path } for the generated file
export const generateTicketPdf = async (booking) => {
    const doc = new PDFDocument({
        size: "A4",
        margin: 40,
    });

    const dir = path.join("uploads", "tickets");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const fileName = `${booking._id}.pdf`;
    const filePath = path.join(dir, fileName);
    const publicUrl = `/uploads/tickets/${fileName}`;

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    /* ---------------- COLORS ---------------- */
    const TEXT = "#111111";
    const MUTED = "#555555";
    const BORDER = "#dddddd";
    const BRAND = "#0ea5e9";

    /* ---------------- HEADER ---------------- */
    doc
        .font("Helvetica-Bold")
        .fontSize(24)
        .fillColor(BRAND)
        .text("MovieMint", { align: "center" });

    doc
        .moveDown(0.5)
        .fontSize(10)
        .fillColor(MUTED)
        .text("Official Movie Ticket", { align: "center" });

    doc.moveDown(1.5);

    /* ---------------- TICKET BOX ---------------- */
    const boxX = doc.page.margins.left;
    const boxY = doc.y;
    const boxW =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const boxH = 220;

    doc
        .roundedRect(boxX, boxY, boxW, boxH, 8)
        .stroke(BORDER);

    /* ---------------- LEFT SIDE ---------------- */
    const leftX = boxX + 20;
    let y = boxY + 20;

    doc
        .font("Helvetica-Bold")
        .fontSize(18)
        .fillColor(TEXT)
        .text(booking.show.movie.title, leftX, y, {
            width: boxW - 180,
        });

    y += 35;

    doc
        .font("Helvetica")
        .fontSize(12)
        .fillColor(MUTED)
        .text("Theater", leftX, y);

    y += 14;

    doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor(TEXT)
        .text(booking.show.theater.name, leftX, y);

    y += 25;

    const showDate = new Date(booking.show.showDateTime);

    doc
        .font("Helvetica")
        .fontSize(12)
        .fillColor(TEXT)
        .text(
            `Date: ${showDate.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
            })}`,
            leftX,
            y
        );

    y += 18;

    doc.text(
        `Time: ${showDate.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        })}`,
        leftX,
        y
    );

    y += 18;

    doc.text(`Seats: ${booking.seats.join(", ")}`, leftX, y);

    y += 18;

    doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor(TEXT)
        .text(`Amount Paid: ₹ ${booking.amount}`, leftX, y);

    /* ---------------- RIGHT SIDE (QR) ---------------- */
    const qrSize = 120;
    const qrX = boxX + boxW - qrSize - 20;
    const qrY = boxY + 40;

    const qrDataUrl = await QRCode.toDataURL(publicUrl);

    doc.image(qrDataUrl, qrX, qrY, {
        width: qrSize,
        height: qrSize,
    });

    doc
        .fontSize(10)
        .fillColor(MUTED)
        .text("Scan for ticket", qrX, qrY + qrSize + 6, {
            width: qrSize,
            align: "center",
        });

    /* ---------------- FOOTER ---------------- */
    doc.moveDown(6);

    doc
        .fontSize(9)
        .fillColor(MUTED)
        .text(
            "This ticket is valid only for the show mentioned above. Please carry a valid ID.",
            { align: "center" }
        );

    doc.end();

    return new Promise((resolve, reject) => {
        stream.on("finish", () => {
            resolve({
                url: publicUrl,
                path: filePath,
            });
        });
        stream.on("error", (err) => {
            reject(new Error(`Ticket PDF write failed: ${err.message}`));
        });
        doc.on("error", (err) => {
            reject(new Error(`Ticket PDF generation failed: ${err.message}`));
        });
    });
};