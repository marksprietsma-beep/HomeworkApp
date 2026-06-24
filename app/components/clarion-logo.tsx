import Image from "next/image";

export const CLARION_TAGLINE =
  "structured homework, feedback and learning clarity.";

const BRAND_ASSET_PATHS = {
  primary: "/brand/clarion_primary_logo.png",
  appIcon: "/brand/clarion_app_icon.png",
  monochrome: "/brand/clarion_monochrome_logo.png",
} as const;

type ClarionLogoProps = {
  compact?: boolean;
  monochrome?: boolean;
  className?: string;
  markClassName?: string;
  textClassName?: string;
};

export function ClarionMark({
  className = "h-10 w-10",
}: {
  monochrome?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={BRAND_ASSET_PATHS.appIcon}
      alt=""
      aria-hidden="true"
      width={128}
      height={128}
      className={`${className} rounded-xl object-contain`}
    />
  );
}

export function ClarionLogo({
  compact = false,
  monochrome = false,
  className = "inline-flex items-center gap-3",
  markClassName = compact ? "h-9 w-9" : "h-14 w-auto",
  textClassName = "text-left",
}: ClarionLogoProps) {
  if (compact) {
    return (
      <span className={className} aria-label="Clarion">
        <ClarionMark className={markClassName} />
        <span
          className={`text-base font-bold leading-none tracking-tight ${
            monochrome ? "text-current" : "text-slate-950"
          } ${textClassName}`}
        >
          Clarion
        </span>
      </span>
    );
  }

  return (
    <span className={className}>
      <Image
        src={monochrome ? BRAND_ASSET_PATHS.monochrome : BRAND_ASSET_PATHS.primary}
        alt="Clarion logo"
        width={640}
        height={180}
        priority
        className={`${markClassName} object-contain`}
      />
    </span>
  );
}
