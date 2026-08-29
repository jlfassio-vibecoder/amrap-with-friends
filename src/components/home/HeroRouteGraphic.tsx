/**
 * The charted route from the brand kit: a squad of markers converging into a
 * plotted course, waypoint by waypoint, toward the North Star. Drawn as inline
 * SVG rather than a raster export so it stays crisp, scales with the hero, and
 * costs no extra request.
 */

/** On-curve anchors of the route path — waypoint rings are placed on these so
 * the markers always sit exactly on the line. */
const WAYPOINTS = [
  { cx: 215, cy: 520 },
  { cx: 355, cy: 400 },
  { cx: 515, cy: 300 },
  { cx: 640, cy: 175 },
] as const;

/** Route begins at the squad convergence so leader lines and the mission path
 * share one origin instead of floating apart. */
const ROUTE_PATH =
  'M 108 628 C 145 595, 175 560, 215 520 C 265 455, 290 445, 355 400 ' +
  'C 420 355, 450 355, 515 300 C 580 245, 585 215, 640 175 ' +
  'C 695 135, 715 120, 760 80';

/** Plausible-but-not-taken bearings that float beside the live route —
 * dotted, unanchored, never touching the squad merge or North Star. */
const FLOATING_ROUTES = [
  // Existing faint alternate, kept below the live path.
  'M 90 660 C 210 610, 300 590, 380 520 C 460 450, 470 370, 560 320 ' +
    'C 650 270, 700 200, 770 100',
  // Upper float — shorter arc sitting above the mission path.
  'M 250 480 C 330 420, 410 360, 490 290 C 560 235, 620 175, 690 120',
  // Lower float — wider, lazier curve beneath the climb.
  'M 160 700 C 280 655, 390 600, 500 520 C 590 455, 680 360, 800 250',
] as const;

/**
 * Squad markers at the head of the route. Every marker draws a leader line
 * into the shared path start so the squad visibly converges onto the mission
 * route rather than floating beside it.
 */
const SQUAD = [
  { cx: 28, cy: 656 },
  { cx: 58, cy: 642 },
  { cx: 40, cy: 692 },
  { cx: 70, cy: 678 },
] as const;
const SQUAD_CONVERGENCE = { x: 108, y: 628 } as const;

/** Small survey crosshairs scattered over the grid. */
const CROSSHAIRS = [
  { x: 300, y: 180 },
  { x: 610, y: 430 },
  { x: 470, y: 90 },
  { x: 780, y: 330 },
] as const;

export function HeroRouteGraphic() {
  return (
    <svg
      viewBox="0 0 880 720"
      className="h-auto w-full"
      role="img"
      aria-label="Four squad markers converging onto a charted route that climbs through waypoints toward a North Star."
    >
      <defs>
        <pattern id="awf-hero-grid" width="146" height="146" patternUnits="userSpaceOnUse">
          <path
            d="M146 0 H0 V146"
            fill="none"
            stroke="var(--color-night-secondary)"
            strokeOpacity="0.16"
            strokeWidth="1"
            strokeDasharray="5 8"
          />
        </pattern>

        <radialGradient id="awf-hero-glow">
          <stop offset="0%" stopColor="var(--color-gold)" stopOpacity="0.5" />
          <stop offset="45%" stopColor="var(--color-gold)" stopOpacity="0.14" />
          <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="0" />
        </radialGradient>

        <linearGradient id="awf-hero-route" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-gold)" stopOpacity="0.35" />
          <stop offset="35%" stopColor="var(--color-gold)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="1" />
        </linearGradient>
      </defs>

      <rect width="880" height="720" fill="url(#awf-hero-grid)" />

      {/* Faint topographic contours in the lower right, as on the brand chart. */}
      <g fill="none" stroke="var(--color-night-secondary)" strokeOpacity="0.1" strokeWidth="1.5">
        <path d="M880 430 C 790 470, 745 545, 760 640 C 770 700, 815 715, 880 712" />
        <path d="M880 480 C 810 515, 775 570, 790 645 C 800 700, 840 712, 880 710" />
        <path d="M880 535 C 840 560, 815 600, 828 650 C 838 692, 862 706, 880 706" />
      </g>

      {CROSSHAIRS.map(({ x, y }) => (
        <path
          key={`${x}-${y}`}
          d={`M${x - 8} ${y} H${x + 8} M${x} ${y - 8} V${y + 8}`}
          stroke="var(--color-night-secondary)"
          strokeOpacity="0.32"
          strokeWidth="1.5"
        />
      ))}

      {FLOATING_ROUTES.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke="var(--color-night-secondary)"
          strokeOpacity="0.22"
          strokeWidth="1.5"
          strokeDasharray="5 9"
          strokeLinecap="round"
        />
      ))}

      <path
        d={ROUTE_PATH}
        fill="none"
        stroke="url(#awf-hero-route)"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Squad markers converging into the head of the route. */}
      <g>
        {SQUAD.map(({ cx, cy }) => (
          <g key={`${cx}-${cy}`}>
            <line
              x1={cx}
              y1={cy}
              x2={SQUAD_CONVERGENCE.x}
              y2={SQUAD_CONVERGENCE.y}
              stroke="var(--color-gold)"
              strokeOpacity="0.55"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
            <circle cx={cx} cy={cy} r="12" fill="var(--color-gold)" fillOpacity="0.14" />
            <circle cx={cx} cy={cy} r="6" fill="var(--color-gold)" />
          </g>
        ))}
        {/* Anchor where the squad strands meet the mission path. */}
        <circle
          cx={SQUAD_CONVERGENCE.x}
          cy={SQUAD_CONVERGENCE.y}
          r="3.5"
          fill="var(--color-gold)"
        />
      </g>

      {WAYPOINTS.map(({ cx, cy }) => (
        <g key={`${cx}-${cy}`}>
          <circle cx={cx} cy={cy} r="13" fill="var(--color-gold)" fillOpacity="0.12" />
          <circle
            cx={cx}
            cy={cy}
            r="8"
            fill="var(--color-navy)"
            stroke="var(--color-gold)"
            strokeWidth="2.5"
          />
          <circle cx={cx} cy={cy} r="2" fill="var(--color-gold)" />
        </g>
      ))}

      {/* North Star. */}
      <circle cx="760" cy="80" r="130" fill="url(#awf-hero-glow)" />
      <path
        d="M760 0 C 766 52, 774 62, 828 74 C 774 86, 766 96, 760 160
           C 754 96, 746 86, 692 74 C 746 62, 754 52, 760 0 Z"
        fill="var(--color-gold)"
      />
      <path
        d="M760 34 C 763 62, 769 68, 800 74 C 769 80, 763 86, 760 122
           C 757 86, 751 80, 720 74 C 751 68, 757 62, 760 34 Z"
        fill="var(--color-night-ink)"
        fillOpacity="0.75"
      />
    </svg>
  );
}
