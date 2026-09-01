/**
 * Fechas en hora de Colombia.
 *
 * OJO: `new Date().toISOString().slice(0, 10)` devuelve la fecha en UTC, que
 * va 5 horas ADELANTE de Colombia. Entre las 7:00 p.m. y la medianoche eso
 * da el día siguiente — una compra registrada a las 8 de la noche quedaba
 * fechada mañana, y las validaciones de "no puede ser futura" dejaban pasar
 * el día de mañana. Todo lo que sea "hoy" debe salir de aquí.
 */

/** Fecha de hoy en hora de Colombia, formato YYYY-MM-DD. */
export function bogotaToday(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Bogota",
  });
}

/** Mes actual en hora de Colombia, formato YYYY-MM. */
export function bogotaThisMonth(): string {
  return bogotaToday().slice(0, 7);
}
