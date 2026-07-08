/**
 * Converts decimal feet to feet-inches format
 * @param decimalFeet - The measurement in decimal feet (e.g., 10.5)
 * @returns Formatted string in feet-inches (e.g., "10' 6\"")
 */
export function formatFeetInches(decimalFeet: number): string {
  const isNegative = decimalFeet < 0;
  const absValue = Math.abs(decimalFeet);

  const feet = Math.floor(absValue);
  const remainingInches = (absValue - feet) * 12;
  const inches = Math.round(remainingInches);

  const prefix = isNegative ? '-' : '';

  // Handle case where rounding gives us 12 inches
  if (inches === 12) {
    return `${prefix}${feet + 1}' 0"`;
  }

  // Only inches (less than 1 foot)
  if (feet === 0) {
    return `${prefix}${inches}"`;
  }

  // Only feet (no inches)
  if (inches === 0) {
    return `${prefix}${feet}'`;
  }

  // Both feet and inches
  return `${prefix}${feet}' ${inches}"`;
}

/**
 * Formats a measurement value based on its unit type
 * @param value - The measurement value
 * @param unit - The unit type ('LF', 'SF', 'EA')
 * @returns Formatted string
 */
export function formatMeasurement(value: number, unit: string): string {
  if (unit === 'LF') {
    return formatFeetInches(value);
  }
  // For SF and EA, keep decimal format
  return `${value.toFixed(1)} ${unit}`;
}
