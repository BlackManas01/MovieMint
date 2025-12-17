import React, { useEffect, useState } from "react";
import Loading from "../../components/Loading"; // fallback (optional)
import Title from "../../components/admin/Title";
import { dateFormat } from "../../lib/dateFormat";
import { useAppContext } from "../../context/AppContext";

const PAGE_SIZE = 10;

// ---------------------- SKELETON ROW COMPONENT ----------------------
const SkeletonRow = () => {
  return (
    <tr className="border-b border-primary/20">
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="p-3">
          <div className="h-4 w-24 bg-white/10 rounded animate-pulse"></div>
        </td>
      ))}
    </tr>
  );
};

// ---------------------- MAIN COMPONENT ----------------------
const ListBookings = () => {
  const currency = import.meta.env.VITE_CURRENCY;

  const { axios, getToken, user } = useAppContext();

  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);

  const getAllBookings = async () => {
    try {
      const { data } = await axios.get("/api/admin/all-bookings", {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });

      const list = Array.isArray(data.bookings) ? data.bookings : [];

      list.sort((a, b) => {
        const aTime = new Date(a.show?.showDateTime || 0).getTime();
        const bTime = new Date(b.show?.showDateTime || 0).getTime();
        return bTime - aTime;
      });

      setBookings(list);
    } catch (error) {
      console.error("all-bookings error:", error);
      setBookings([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      getAllBookings();
    }
  }, [user]);

  useEffect(() => {
    setPage(1);
  }, [bookings.length]);

  // ----------------------- LOADING SKELETON ------------------------
  if (isLoading) {
    return (
      <>
        <Title text1="List" text2="Bookings" />

        <div className="max-w-4xl mt-6 overflow-x-auto">
          <table className="w-full border-collapse rounded-md overflow-hidden text-nowrap">
            <thead>
              <tr className="bg-primary/20 text-left text-white">
                <th className="p-2 pl-5">User Name</th>
                <th className="p-2">Movie Name</th>
                <th className="p-2">Show Time</th>
                <th className="p-2">Seats</th>
                <th className="p-2">Amount</th>
              </tr>
            </thead>

            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  // Only PAID bookings
  const paidBookings = bookings.filter((b) => b.isPaid === true);

  const total = paidBookings.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const pageItems = paidBookings.slice(startIndex, endIndex);

  return (
    <>
      <Title text1="List" text2="Bookings" />

      <div className="max-w-4xl mt-6">
        {/* PAGINATION SUMMARY */}
        <div className="flex items-center justify-between mb-3 text-xs text-gray-400">
          <span>
            Showing{" "}
            {total === 0 ? "0" : `${startIndex + 1}–${Math.min(endIndex, total)}`}{" "}
            of {total} bookings
          </span>

          {total > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 rounded border border-white/10 disabled:opacity-40 text-[11px]"
              >
                Prev
              </button>

              <span>
                Page {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 rounded border border-white/10 disabled:opacity-40 text-[11px]"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse rounded-md overflow-hidden text-nowrap">
            <thead>
              <tr className="bg-primary/20 text-left text-white">
                <th className="p-2 pl-5">User Name</th>
                <th className="p-2">Movie Name</th>
                <th className="p-2">Show Time</th>
                <th className="p-2">Seats</th>
                <th className="p-2">Amount</th>
              </tr>
            </thead>

            <tbody className="text-sm font-light">
              {total === 0 ? (
                <tr>
                  <td colSpan={5} className="p-3 text-center text-gray-400">
                    No bookings found.
                  </td>
                </tr>
              ) : (
                pageItems.map((item, index) => {
                  // USER NAME
                  let userName = "Guest / Deleted User";
                  if (item.user) {
                    if (item.user.name) userName = item.user.name;
                    else if (item.user.firstName || item.user.lastName)
                      userName = `${item.user.firstName || ""} ${item.user.lastName || ""
                        }`.trim();
                    else if (item.user.email) userName = item.user.email;
                  }

                  // MOVIE NAME
                  const movieTitle =
                    item.movieTitle ||
                    item.show?.movieTitle ||
                    item.show?.movie?.title ||
                    "Unknown Movie";

                  // SHOW TIME
                  const showTime = item.show?.showDateTime
                    ? dateFormat(item.show.showDateTime)
                    : "—";

                  // SEATS
                  const bookedSeatsObj = item.bookedSeats || {};
                  const seatLabels = Object.keys(bookedSeatsObj).length
                    ? Object.keys(bookedSeatsObj)
                      .map((seat) => bookedSeatsObj[seat])
                      .join(", ")
                    : "-";

                  return (
                    <tr
                      key={item._id || index}
                      className="border-b border-primary/20 bg-primary/5 even:bg-primary/10"
                    >
                      <td className="p-2 pl-5">{userName}</td>
                      <td className="p-2">{movieTitle}</td>
                      <td className="p-2">{showTime}</td>
                      <td className="p-2">{seatLabels}</td>
                      <td className="p-2">
                        {currency} {item.amount ?? 0}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default ListBookings;