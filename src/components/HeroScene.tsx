/** Original atmospheric forest scene used behind the home hero. */
export function HeroScene() {
  const fairies = [
    [120, 210, 0], [260, 150, 1.2], [420, 250, 2.1], [610, 170, 0.6], [780, 230, 1.7],
    [930, 140, 2.6], [1080, 220, 0.3], [1210, 160, 1.4], [340, 300, 2.9], [880, 300, 0.9],
  ];
  return (
    <svg viewBox="0 0 1300 520" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1d2a" />
          <stop offset="0.45" stopColor="#1b3f3a" />
          <stop offset="0.8" stopColor="#3d5a2c" />
          <stop offset="1" stopColor="#1a2e17" />
        </linearGradient>
        <radialGradient id="glow" cx="0.62" cy="0.55" r="0.45">
          <stop offset="0" stopColor="#f3e2a9" stopOpacity="0.55" />
          <stop offset="0.4" stopColor="#d6b25a" stopOpacity="0.15" />
          <stop offset="1" stopColor="#d6b25a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cfe8d6" stopOpacity="0" />
          <stop offset="1" stopColor="#cfe8d6" stopOpacity="0.18" />
        </linearGradient>
        <radialGradient id="fairy">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.25" stopColor="#a9e4ff" />
          <stop offset="1" stopColor="#6fc8f0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.6" stopColor="#08130d" stopOpacity="0" />
          <stop offset="1" stopColor="#08130d" />
        </linearGradient>
      </defs>
      <rect width="1300" height="520" fill="url(#sky)" />
      <rect width="1300" height="520" fill="url(#glow)" />
      {/* light shafts */}
      <g fill="#f3e2a9" opacity="0.07">
        <path d="M760 0 L840 0 L700 520 L560 520 Z" />
        <path d="M900 0 L940 0 L860 520 L780 520 Z" />
        <path d="M640 0 L680 0 L470 520 L420 520 Z" />
      </g>
      {/* distant mountains */}
      <path d="M0 330 L120 250 L210 300 L360 200 L470 280 L560 230 L700 300 L820 210 L960 290 L1080 240 L1300 310 L1300 520 L0 520 Z" fill="#23443a" opacity="0.7" />
      <rect y="250" width="1300" height="130" fill="url(#mist)" />
      {/* mid forest */}
      <path
        d="M0 380 C40 330 60 340 80 300 C100 340 130 330 150 290 C175 330 200 320 230 280 C255 330 290 320 320 300 C350 340 380 330 400 310 L400 520 L0 520 Z"
        fill="#16301f"
      />
      <path
        d="M900 330 C930 290 960 300 990 260 C1010 300 1040 290 1070 250 C1090 290 1130 290 1160 270 C1190 310 1240 300 1300 280 L1300 520 L900 520 Z"
        fill="#16301f"
      />
      {/* great tree */}
      <g fill="#0f2418">
        <path d="M120 520 C150 420 150 300 120 180 L190 180 C170 300 180 420 230 520 Z" />
        <path d="M-40 200 C20 80 180 40 300 110 C360 60 460 110 430 190 C470 240 400 290 330 260 C260 300 140 290 90 250 C10 280 -60 260 -40 200 Z" />
        <path d="M1150 520 C1170 430 1165 330 1140 240 L1195 240 C1185 330 1200 430 1240 520 Z" />
        <path d="M1000 260 C1040 170 1160 140 1240 190 C1300 150 1360 200 1340 250 C1360 300 1280 320 1220 300 C1160 330 1060 320 1000 260 Z" />
      </g>
      {/* foreground ferns */}
      <path d="M0 470 C80 430 160 440 260 470 C360 430 460 450 560 480 C700 440 820 450 940 480 C1060 440 1180 450 1300 470 L1300 520 L0 520 Z" fill="#0b1a10" />
      {fairies.map(([x, y, d], i) => (
        <g key={i} className="animate-float" style={{ animationDelay: `${d}s`, animationDuration: `${6 + (i % 4)}s` }}>
          <circle cx={x} cy={y} r={i % 3 === 0 ? 14 : 9} fill="url(#fairy)" className="animate-twinkle" style={{ animationDelay: `${d}s` }} />
        </g>
      ))}
      <rect width="1300" height="520" fill="url(#fade)" />
    </svg>
  );
}
