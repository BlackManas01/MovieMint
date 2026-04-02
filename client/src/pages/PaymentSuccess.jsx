// pages/PaymentSuccess.jsx - Finalizes booking after Stripe payment redirect
import { useAuth } from "@clerk/clerk-react";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Loading from "../components/Loading";

const PaymentSuccess = () => {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const bookingId = params.get("bookingId");
    const { getToken } = useAuth();

    useEffect(() => {
        if (!bookingId) {
            navigate("/my-bookings");
            return;
        }

        const finalize = async () => {
            try {
                const token = await getToken();
                // 🔥 THIS IS THE FIX (SERVER CONFIRM)
                await fetch("/api/booking/confirm-booking", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ bookingId }),
                });
            } catch (e) {
                console.error("confirm booking failed", e);
            }

            // 🔥 UI CLEANUP (SAFE)
            Object.keys(localStorage).forEach((key) => {
                if (!key.startsWith("tempHold:")) return;
                try {
                    const parsed = JSON.parse(localStorage.getItem(key));
                    if (parsed?.bookingId === bookingId) {
                        localStorage.removeItem(key);
                    }
                } catch {
                    localStorage.removeItem(key);
                }
            });

            window.dispatchEvent(new Event("tempHoldChanged"));
            window.dispatchEvent(
                new CustomEvent("PAYMENT_SUCCESS", { detail: { bookingId } })
            );

            navigate("/my-bookings");
        };

        finalize();
    }, [bookingId, navigate]);

    return <Loading text="Finalizing your booking..." />;
};

export default PaymentSuccess;