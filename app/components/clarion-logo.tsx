export const CLARION_TAGLINE =
  "structured homework, feedback and learning clarity.";

type ClarionLogoProps = {
  compact?: boolean;
  monochrome?: boolean;
  className?: string;
  markClassName?: string;
  textClassName?: string;
};

export function ClarionMark({
  monochrome = false,
  className = "h-10 w-10",
}: {
  monochrome?: boolean;
  className?: string;
}) {
  const navy = monochrome ? "currentColor" : "#0f172a";
  const teal = monochrome ? "currentColor" : "#0f766e";
  const gold = monochrome ? "currentColor" : "#d97706";

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M48 14.5C42.9 9.9 35.9 8 29.2 9.4C18.2 11.7 10 21.4 10 32.8C10 45.5 20.1 55.8 32.8 55.8H48.8L44.7 49.1C49.9 44.8 53 38.5 53 31.6"
        stroke={navy}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M23 30.2C26.9 27.8 30.7 27.8 34.6 30.2V43.4C30.7 41 26.9 41 23 43.4V30.2Z"
        stroke={teal}
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <path
        d="M34.6 30.2C38.5 27.8 42.3 27.8 46.2 30.2V43.4C42.3 41 38.5 41 34.6 43.4V30.2Z"
        stroke={teal}
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <path
        d="M50.8 8.8L54.8 4.8M55.7 17.2H61M44.4 5.2L43.1 1"
        stroke={gold}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ClarionLogo({
  compact = false,
  monochrome = false,
  className = "inline-flex items-center gap-3",
  markClassName = compact ? "h-9 w-9" : "h-11 w-11",
  textClassName = "text-left",
}: ClarionLogoProps) {
  return (
    <span className={className} aria-label="Clarion">
      <ClarionMark monochrome={monochrome} className={markClassName} />
      {compact ? null : (
        <span className={textClassName}>
          <span className="block text-xl font-bold leading-none tracking-tight text-slate-950">
            Clarion
          </span>
          <span className="mt-1 block text-xs font-medium leading-4 text-slate-500">
            {CLARION_TAGLINE}
          </span>
        </span>
      )}
    </span>
  );
}
