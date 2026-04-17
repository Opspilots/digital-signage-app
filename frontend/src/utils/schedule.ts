/**
 * Day-of-week bitmask utilities.
 * Encoding: Lun=1, Mar=2, Mié=4, Jue=8, Vie=16, Sáb=32, Dom=64
 * (matches JS Date.getDay() mapping: 0=Dom→64, 1=Lun→1, ..., 6=Sáb→32)
 */

export const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;
export const DAY_BITS = [1, 2, 4, 8, 16, 32, 64] as const; // índice 0=Lun, índice 6=Dom

/** Devuelve el bit de bitmask para el día de JS (0=Dom…6=Sáb). */
export function jsDowToBit(jsDow: number): number {
  return jsDow === 0 ? 64 : (1 << (jsDow - 1));
}

/** Comprueba si un ítem está activo para el día representado por el bitmask. */
export function isDayActive(bitmask: number, dayIndex: number): boolean {
  return (bitmask & DAY_BITS[dayIndex]) !== 0;
}

/**
 * Construye un texto legible del bitmask.
 * Ej: 31 → "Entre semana", 96 → "Fines de semana", 127 → "Todos los días"
 */
export function daysLabel(mask: number): string {
  if (mask === 127) return 'Todos los días';
  if (mask === 31)  return 'Entre semana';
  if (mask === 96)  return 'Fines de semana';
  return DAYS.filter((_, i) => mask & DAY_BITS[i]).join(', ');
}
