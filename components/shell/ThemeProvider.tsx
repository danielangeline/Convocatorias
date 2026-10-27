"use client";

import { ThemeProvider as NextThemes } from "next-themes";

// Tema por defecto: el del sistema. La persona lo cambia en la barra o en Ajustes.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}
