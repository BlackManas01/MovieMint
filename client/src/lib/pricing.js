// lib/pricing.js - Booking fee + coupon rules (mirrored on the server in bookingController).
export const PLATFORM_FEE_PER_TICKET = 25; // ₹ booking/convenience fee per seat

export const COUPONS = {
    MOVIE50: { label: "50% off up to ₹150", apply: (t) => Math.min(150, Math.round(t * 0.5)) },
    FLAT100: { label: "₹100 off on ₹500+", apply: (t) => (t >= 500 ? 100 : 0) },
    UPI50: { label: "₹50 off", apply: () => 50 },
};

export const platformFeeFor = (seatCount) => PLATFORM_FEE_PER_TICKET * Math.max(0, Number(seatCount) || 0);

// Returns { code, discount, valid }. discount never exceeds the ticket subtotal.
export const applyCoupon = (code, ticketsSubtotal) => {
    const c = String(code || "").toUpperCase().trim();
    const def = COUPONS[c];
    if (!def) return { code: c, discount: 0, valid: false };
    const d = Math.max(0, Math.min(Number(ticketsSubtotal) || 0, def.apply(Number(ticketsSubtotal) || 0)));
    return { code: c, discount: d, valid: d > 0 };
};
