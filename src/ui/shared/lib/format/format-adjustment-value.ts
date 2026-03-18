/**
 * Format a numeric adjustment value for display in a slider label.
 * @param value   - the raw numeric value
 * @param decimals - number of decimal places (0 = round to integer)
 */
export function formatAdjustmentValue(value: number, decimals: number): string {
  return decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
}
