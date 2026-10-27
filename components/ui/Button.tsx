import Link from "next/link";
import { cn } from "@/lib/utils";

// "teal" y "brick" se conservan como alias de "ai" y "consultor" mientras las
// pantallas migran; el rediseño usa violeta para la IA y celeste para consultores.
type Variante =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "outline-gold"
  | "ai"
  | "teal"
  | "consultor"
  | "brick";
type Tamano = "sm" | "md" | "lg";

const ai =
  "bg-[color-mix(in_oklch,var(--violet)_10%,transparent)] text-[color-mix(in_oklch,var(--violet)_70%,var(--ink))] border border-[color-mix(in_oklch,var(--violet)_45%,transparent)] hover:bg-[color-mix(in_oklch,var(--violet)_18%,transparent)]";
const consultor = "bg-sky text-white hover:brightness-95";

const variantes: Record<Variante, string> = {
  primary: "bg-pri text-on-pri hover:bg-pri-hover",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  ghost: "bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-rose text-white hover:brightness-95",
  "outline-gold":
    "bg-surface text-[color-mix(in_oklch,var(--amber)_62%,var(--ink))] border border-amber hover:bg-surface-2",
  ai,
  teal: ai,
  consultor,
  brick: consultor,
};

const tamanos: Record<Tamano, string> = {
  sm: "h-9 px-3 text-[13px]",
  md: "h-[38px] px-4 text-[13px]",
  lg: "h-11 px-5 text-sm",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-[10px] font-bold transition-colors cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-current/0";

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
