/** Height stored as int cm; weight as numeric(5,1) kg. */

export type BodyMetricUnitSystem = 'imperial' | 'metric';

export const HEIGHT_CM_MIN = 100;
export const HEIGHT_CM_MAX = 250;
export const WEIGHT_KG_MIN = 30;
export const WEIGHT_KG_MAX = 250;

/** Imperial ranges that map inside metric DB checks. */
export const HEIGHT_IN_MIN = 40;
export const HEIGHT_IN_MAX = 98;
export const WEIGHT_LB_MIN = 66;
export const WEIGHT_LB_MAX = 551;

const CM_PER_IN = 2.54;
const LB_PER_KG = 2.2046226218;

export function cmToIn(cm: number): number {
  return Math.round(cm / CM_PER_IN);
}

export function inToCm(inches: number): number {
  return Math.round(inches * CM_PER_IN);
}

export function kgToLb(kg: number): number {
  return Math.round(kg * LB_PER_KG * 10) / 10;
}

export function lbToKg(lb: number): number {
  return Math.round((lb / LB_PER_KG) * 10) / 10;
}

export function isValidHeight(value: number, system: BodyMetricUnitSystem): boolean {
  if (!Number.isInteger(value)) {
    return false;
  }
  if (system === 'imperial') {
    return value >= HEIGHT_IN_MIN && value <= HEIGHT_IN_MAX;
  }
  return value >= HEIGHT_CM_MIN && value <= HEIGHT_CM_MAX;
}

export function isValidWeight(value: number, system: BodyMetricUnitSystem): boolean {
  if (!Number.isFinite(value)) {
    return false;
  }
  if (system === 'imperial') {
    return value >= WEIGHT_LB_MIN && value <= WEIGHT_LB_MAX;
  }
  return value >= WEIGHT_KG_MIN && value <= WEIGHT_KG_MAX;
}

export function toMetricHeight(value: number, system: BodyMetricUnitSystem): number {
  return system === 'imperial' ? inToCm(value) : value;
}

export function toMetricWeight(value: number, system: BodyMetricUnitSystem): number {
  return system === 'imperial' ? lbToKg(value) : value;
}

export function fromMetricHeight(cm: number, system: BodyMetricUnitSystem): number {
  return system === 'imperial' ? cmToIn(cm) : cm;
}

export function fromMetricWeight(kg: number, system: BodyMetricUnitSystem): number {
  return system === 'imperial' ? kgToLb(kg) : kg;
}
