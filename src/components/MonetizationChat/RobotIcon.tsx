export default function RobotIcon({ size = 64, color = "#00C8C8" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer head */}
      <rect
        x="8"
        y="16"
        width="48"
        height="40"
        rx="12"
        stroke={color}
        strokeWidth="4"
        fill="none"
      />

      {/* Side ears */}
      <rect x="2" y="30" width="8" height="12" rx="4" fill={color} />
      <rect x="54" y="30" width="8" height="12" rx="4" fill={color} />

      {/* Antenna */}
      <rect x="30" y="4" width="4" height="10" rx="2" fill={color} />
      <circle cx="32" cy="4" r="4" fill={color} />

      {/* Eyes */}
      <rect x="20" y="28" width="8" height="8" rx="2" fill={color} />
      <rect x="36" y="28" width="8" height="8" rx="2" fill={color} />

      {/* Mouth (moved up with big lower radius) */}
      <path
        d="M22 38
             h20
             a3 3 0 0 1 3 3
             v4
             a8 8 0 0 1 -8 8
             h-10
             a8 8 0 0 1 -8 -8
             v-4
             a3 3 0 0 1 3 -3
             z"
        fill={color}
      />
    </svg>
  );
}
