// components/OffersStrip.jsx - Horizontally scrollable promotional offers (home page)
import React from "react";
import { TicketPercent, CreditCard, Popcorn, CalendarHeart } from "lucide-react";

const OFFERS = [
  {
    icon: TicketPercent,
    title: "50% OFF on Tuesdays",
    sub: "Use code MOVIE50 · up to $5 off",
    from: "from-violet-500/20",
    to: "to-fuchsia-500/10",
  },
  {
    icon: CreditCard,
    title: "Extra $1 with UPI",
    sub: "On every ticket, all shows",
    from: "from-emerald-500/20",
    to: "to-teal-500/10",
  },
  {
    icon: Popcorn,
    title: "Free combo upgrade",
    sub: "On 4 tickets & above",
    from: "from-amber-500/20",
    to: "to-orange-500/10",
  },
  {
    icon: CalendarHeart,
    title: "Weekend Family Pack",
    sub: "Flat 20% for 4+ seats",
    from: "from-sky-500/20",
    to: "to-blue-500/10",
  },
];

const OffersStrip = () => {
  return (
    <section className="px-6 md:px-16 lg:px-24 xl:px-44 pt-16">
      <div className="flex items-center justify-between mb-5">
        <p className="text-shade font-semibold text-2xl">Offers for you</p>
      </div>
      <div className="relative">
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 pr-10">
          {OFFERS.map((o) => (
            <div
              key={o.title}
              className={`shrink-0 w-72 rounded-2xl border border-white/10 bg-gradient-to-br ${o.from} ${o.to} p-5 backdrop-blur-sm hover:border-primary/40 transition`}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 border border-white/15 mb-4">
                <o.icon className="w-5 h-5 text-primary" />
              </div>
              <p className="font-semibold">{o.title}</p>
              <p className="text-xs text-gray-300 mt-1">{o.sub}</p>
            </div>
          ))}
        </div>
        {/* Scroll hint */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-12 fade-right-edge" />
      </div>
    </section>
  );
};

export default OffersStrip;
