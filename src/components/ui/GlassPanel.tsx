import type { ComponentPropsWithoutRef } from "react";

interface GlassPanelProps extends ComponentPropsWithoutRef<"div"> {
  children: React.ReactNode;
}

export function GlassPanel({
  children,
  className = "",
  ...props
}: GlassPanelProps) {
  return (
    <div
      className={`border border-white/10 bg-black/80 text-white shadow-[0_0_40px_rgba(0,0,0,0.35)] backdrop-blur-md ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
