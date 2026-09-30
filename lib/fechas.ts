/**
 * Hoy en Colombia, AAAA-MM-DD. Una convocatoria vence al terminar su día de
 * cierre en hora de Bogotá (RN-02, CU-06); en la base, la misma regla es
 * `privado.hoy_colombia()`. Sirve en el servidor y en el navegador.
 */
export function hoyColombia(): string {
  return fechaColombia(new Date());
}

/** El día en Colombia, AAAA-MM-DD, de un instante (p. ej. un `timestamptz` de la base). */
export function fechaColombia(instante: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date(instante));
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

/**
 * Fecha y hora en Colombia, "30 sept 2026, 18:16". Se arma a mano para que el
 * servidor y el navegador escriban exactamente lo mismo: el formato regional
 * de Intl cambia los espacios de "p. m." entre Node y el navegador, y rompe la
 * hidratación.
 */
export function fechaHoraColombia(instante: Date | string): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(instante))
      .map((p) => [p.type, p.value])
  );
  return `${partes.day} ${MESES[Number(partes.month) - 1]} ${partes.year}, ${partes.hour}:${partes.minute}`;
}
