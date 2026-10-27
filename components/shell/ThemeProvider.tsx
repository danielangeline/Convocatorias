"use client";

import { ThemeProvider as NextThemes } from "next-themes";

// Por defecto claro mientras el rediseño migra pantalla por pantalla; pasa a
// "system" cuando todas las pantallas respetan el modo oscuro (fase 6).
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}
