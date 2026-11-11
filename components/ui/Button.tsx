import Link from "next/link";
import { cn } from "@/lib/utils";

type Variante = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Tamano = "sm" | "md" | "lg";

const variantes: Record<Variante, string> = {
  primary: "bg-pri text-on-pri hover:bg-pri-hover",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-surface-2",
  outline: "bg-surface text-pri-text border border-pri hover:bg-pri-soft",
  ghost: "bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-transparent text-rose hover:bg-rose-soft",
};

const tamanos: Record<Tamano, string> = {
  sm: "min-h-11 px-3 text-[13px]",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-sm",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-[4px] font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-current/0";

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variante;
  size?: Tamano;
}) {
  return (
    <button className={cn(base, variantes[variant], tamanos[size], className)} {...props}>
      {children}
    </button>
  );
}

export function LinkButton({
  children,
  href,
  variant = "primary",
  size = "md",
  className,
}: {
  children: React.ReactNode;
  href: string;
  variant?: Variante;
  size?: Tamano;
  className?: string;
}) {
  return (
    <Link href={href} className={cn(base, variantes[variant], tamanos[size], className)}>
      {children}
    </Link>
  );
}
