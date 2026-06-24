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
        d="M48.5 16.5C44.1 11.7 37.7 9 30.8 9C17.7 9 7.8 19.2 7.8 32C7.8 44.8 17.7 55 30.8 55C37.9 55 44.3 52.1 48.8 47.3"
        stroke={navy}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.8 27.4C24.5 24.4 29.1 24.4 33.8 27.4V43.8C29.1 40.8 24.5 40.8 19.8 43.8V27.4Z"
        stroke={teal}
        strokeWidth="3.4"
        strokeLinejoin="round"
      />
      <path
        d="M33.8 27.4C38.5 24.4 43.1 24.4 47.8 27.4V43.8C43.1 40.8 38.5 40.8 33.8 43.8V27.4Z"
        stroke={teal}
        strokeWidth="3.4"
        strokeLinejoin="round"
      />
      <path
        d="M52 24.5H57.2M49.7 18.6L53.1 15.2"
        stroke={gold}
        strokeWidth="2.6"
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
