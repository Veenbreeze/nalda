/**
 * Phone number normalization to E.164.
 * Defaults to Tanzania (+255) when a local number is supplied.
 */

const DEFAULT_COUNTRY_CODE = '255';

function digitsOnly(value: string): string {
  return value.replace(/[^\d]/g, '');
}

export function normalizePhone(input: string | null | undefined, defaultCountry = DEFAULT_COUNTRY_CODE): string | null {
  if (!input) return null;
  let raw = String(input).trim();
  if (!raw) return null;

  // Extract an optional +<digits> or digits run, drop extensions/extra words
  const plusMatch = raw.match(/\+\d[\d\s().-]{5,}/);
  if (plusMatch) raw = plusMatch[0];

  let digits = digitsOnly(raw);
  if (!digits) return null;

  // Strip international dialing prefix 00
  if (digits.startsWith('00')) digits = digits.slice(2);

  // Already has country code and looks international
  if (raw.trim().startsWith('+')) {
    return `+${digits}`;
  }

  if (digits.startsWith(DEFAULT_COUNTRY_CODE) && digits.length >= 11) {
    return `+${digits}`;
  }

  // Leading zero local format e.g. 0747163059
  if (digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '');
    return `+${defaultCountry}${digits}`;
  }

  // Tanzanian mobile without leading zero: 747163059 (9 digits)
  if (digits.length === 9) {
    return `+${defaultCountry}${digits}`;
  }

  // Fallback: assume it already contains a country code
  if (digits.length >= 10) {
    return `+${digits}`;
  }

  return null;
}

export function isValidPhone(input: string | null | undefined): boolean {
  const normalized = normalizePhone(input);
  if (!normalized) return false;
  const digits = normalized.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

/** WhatsApp stores numbers without the leading plus sign. */
export function toWhatsAppNumber(phone: string): string {
  return phone.replace(/^\+/, '');
}

export function fromWhatsAppNumber(wa: string): string {
  return wa.startsWith('+') ? wa : `+${wa}`;
}
