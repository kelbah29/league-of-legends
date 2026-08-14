import type { ReactNode } from "react";

export default function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-border bg-surface p-5 ${className}`}>
      {title && <h2 className="mb-4 text-sm font-semibold text-text-primary">{title}</h2>}
      {children}
    </section>
  );
}
