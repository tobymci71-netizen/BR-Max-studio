import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export function formatMinutes(totalMin: number) {
  if (totalMin < 60) return `${totalMin} min remaining`;

  const hrs = Math.floor(totalMin / 60);
  const mins = Math.floor(totalMin % 60);

  if (mins === 0) return `${hrs} hr${hrs > 1 ? "s" : ""} remaining`;
  return `${hrs} hr${hrs > 1 ? "s" : ""} ${mins} min remaining`;
}
