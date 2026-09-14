/**
 * Redondea importes a centavos con la regla contable ROUND_HALF_UP.
 * La tolerancia relativa corrige residuos binarios como
 * 220.5 * 41918.85 = 9243106.424999999 en JavaScript.
 */
export function redondearMoneda(valor: number): number {
  if (!Number.isFinite(valor)) return 0;

  const escalado = valor * 100;
  const tolerancia = Number.EPSILON * Math.max(1, Math.abs(escalado)) * 2;

  return Math.sign(escalado) * Math.floor(Math.abs(escalado) + 0.5 + tolerancia) / 100;
}
