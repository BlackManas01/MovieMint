// src/components/BlurCircle.jsx
const BlurCircle = ({
  top = "auto",
  left = "auto",
  right = "auto",
  bottom = "auto",
  size = "420px",        // allow custom radius
  color = "rgba(126,34,206,0.25)" // primary purple glow
}) => {
  return (
    <div
      className="absolute pointer-events-none -z-10 blur-[170px] rounded-full"
      style={{
        top,
        left,
        right,
        bottom,
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        transition: "opacity 0.4s ease-in-out"
      }}
    />
  );
};

export default BlurCircle;
