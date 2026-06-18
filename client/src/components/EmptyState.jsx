// components/EmptyState.jsx - Reusable elegant empty-state block (icon + title + subtitle + optional action)
import React from "react";

/**
 * @param {Object} props
 * @param {React.ElementType} [props.icon] - lucide icon component
 * @param {string} props.title - main heading (gets gradient shading)
 * @param {string} [props.subtitle] - supporting line
 * @param {React.ReactNode} [props.action] - optional button/link
 * @param {string} [props.className] - extra wrapper classes
 */
const EmptyState = ({ icon: Icon, title, subtitle, action, className = "" }) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-20 px-6 ${className}`}
    >
      <div className="relative flex h-20 w-20 items-center justify-center mb-5">
        {/* slowly rotating dashed ring */}
        <span className="absolute inset-0 rounded-full border border-dashed border-white/15 animate-[spin_9s_linear_infinite]" />
        {/* soft inner fill */}
        <span className="absolute inset-1 rounded-full bg-white/[0.03]" />
        {Icon ? (
          <Icon className="relative w-8 h-8 text-primary/80 animate-pulse" />
        ) : (
          <span className="relative text-3xl animate-pulse">🎬</span>
        )}
      </div>
      <h2 className="text-shade text-2xl font-semibold mx-auto">{title}</h2>
      {subtitle && (
        <p className="mt-2 max-w-sm text-sm text-gray-400">{subtitle}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
};

export default EmptyState;
