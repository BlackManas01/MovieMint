// utils/generateTicketPdf.js
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";

export const generateTicketPdf = async (booking) => {
    const doc = new PDFDocument({
        size: "A4",
        margin: 0,
    });

    const dir = path.join("uploads", "tickets");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const fileName = `${booking._id}.pdf`;
    const filePath = path.join(dir, fileName);
    const publicUrl = `/uploads/tickets/${fileName}`;

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    /* ---------- COLORS ---------- */
    const BG = "#0b1020";
    const CARD = "#141b2d";
    const TEXT = "#ffffff";
    const MUTED = "#9aa4bf";
    const ACCENT = "#1dd1a1";

    /* ---------- BACKGROUND ---------- */
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(BG);

    /* ---------- HEADER ---------- */
    doc
        .fillColor(ACCENT)
        .fontSize(26)
        .font("Helvetica-Bold")
        .text("MovieMint", 40, 30);

    /* ---------- MAIN CARD ---------- */
    const cardX = 40;
    const cardY = 90;
    const cardW = doc.page.width - 80;
    const cardH = 260;

    doc
        .roundedRect(cardX, cardY, cardW, cardH, 14)
        .fill(CARD);

    /* ---------- POSTER ---------- */
    const posterX = cardX + 20;
    const posterY = cardY + 20;
    const posterW = 110;
    const posterH = 160;

    try {
        if (booking.show.movie.poster_path) {
            const posterUrl = booking.show.movie.poster_path.startsWith("http")
                ? booking.show.movie.poster_path
                : booking.show.movie.poster;

            if (posterUrl) {
                doc.image(posterUrl, posterX, posterY, {
                    width: posterW,
                    height: posterH,
                });
            }
        }
    } catch {
        // ignore poster errors
    }

    /* ---------- QR CODE (LEFT SIDE) ---------- */
    const qrSize = 120;
    const qrDataUrl = await QRCode.toDataURL(publicUrl);

    doc.image(qrDataUrl, posterX, posterY + posterH + 10, {
        width: qrSize,
        height: qrSize,
    });

    /* ---------- MOVIE DETAILS ---------- */
    const infoX = posterX + posterW + 25;
    let cursorY = posterY;

    doc
        .fillColor(TEXT)
        .font("Helvetica-Bold")
        .fontSize(20)
        .text(booking.show.movie.title, infoX, cursorY);

    cursorY += 34;

    doc
        .font("Helvetica")
        .fontSize(12)
        .fillColor(MUTED)
        .text("Theater", infoX, cursorY);

    cursorY += 16;

    doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor(TEXT)
        .text(booking.show.theater.name, infoX, cursorY);

    cursorY += 26;

    const showDate = new Date(booking.show.showDateTime);

    doc
        .font("Helvetica")
        .fontSize(12)
        .fillColor(MUTED)
        .text(
            `${showDate.toLocaleDateString()} • ${showDate.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            })}`,
            infoX,
            cursorY
        );

    /* ---------- BOTTOM INFO ---------- */
    const bottomY = cardY + cardH - 60;

    doc
        .strokeColor("#1f2a44")
        .moveTo(cardX + 20, bottomY - 10)
        .lineTo(cardX + cardW - 20, bottomY - 10)
        .stroke();

    doc
        .fontSize(13)
        .fillColor(TEXT)
        .font("Helvetica-Bold")
        .text(`Seats: ${booking.seats.join(", ")}`, cardX + 20, bottomY);

    doc
        .fontSize(16)
        .fillColor(ACCENT)
        .text(
            `₹ ${booking.amount}`,
            cardX + cardW - 120,
            bottomY,
            { align: "right" }
        );

    /* ---------- FOOT NOTE ---------- */
    doc
        .fontSize(9)
        .fillColor(MUTED)
        .text(
            "Note: This ticket is valid only for the show mentioned above. Please carry a valid ID.",
            40,
            doc.page.height - 50,
            { align: "center" }
        );

    doc.end();

    return new Promise((resolve) => {
        stream.on("finish", () => {
            resolve({
                url: publicUrl,
                path: filePath,
            });
        });
    });
};