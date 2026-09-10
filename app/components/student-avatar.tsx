"use client";

import Image from "next/image";
import { studentInitials } from "../../lib/student-avatar";

type Props = { displayName: string; imagePath: string | null; size?: "sm" | "md" | "lg"; className?: string };

export function StudentAvatar({ displayName, imagePath, size = "md", className = "" }: Props) {
  const dimensions = { sm: "h-10 w-10 text-sm", md: "h-14 w-14 text-lg", lg: "h-28 w-28 text-3xl" }[size];
  return <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-cyan-100 font-bold text-cyan-900 ring-2 ring-white ${dimensions} ${className}`} aria-label={`${displayName}'s profile picture`}>
    <span aria-hidden="true">{studentInitials(displayName)}</span>
    {imagePath ? <Image src={imagePath} alt="" fill sizes={size === "lg" ? "112px" : size === "md" ? "56px" : "40px"} unoptimized className="object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}
  </span>;
}
