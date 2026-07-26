import type { ButtonHTMLAttributes } from "react";

export function Button({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-300 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-200 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
