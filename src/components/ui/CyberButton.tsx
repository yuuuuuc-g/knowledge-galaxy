"use client";

import type { ComponentPropsWithoutRef } from "react";

type CyberButtonVariant = "primary" | "secondary";

interface CyberButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: CyberButtonVariant;
}

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded border px-4 py-3 text-sm font-bold tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-50";

const variantClasses: Record<CyberButtonVariant, string> = {
  primary:
    "border-[#deff9a]/40 bg-[#deff9a]/10 text-[#deff9a] shadow-[0_0_24px_rgba(222,255,154,0.12)] hover:border-[#deff9a]/70 hover:bg-[#deff9a]/20",
  secondary:
    "border-white/20 bg-white/5 text-white/80 hover:border-white/35 hover:bg-white/10 hover:text-white",
};

export function CyberButton({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: CyberButtonProps) {
  return (
    <button
      type={type}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
