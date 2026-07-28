/**
 * Text normalization utilities.
 * Handles Spanish accent rules for uppercase text.
 * In correct Spanish, uppercase letters should NOT have accents.
 */

const UPPERCASE_ACCENT_MAP: Record<string, string> = {
  'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
  'Ü': 'U',
};

/**
 * Removes accents from uppercase letters while preserving accents in lowercase.
 * Use this when displaying text in uppercase context (e.g., CSS text-transform: uppercase).
 */
export function removeAccentUppercase(text: string): string {
  return text.replace(/[A-ZÁÉÍÓÚÜ]/g, (char) => UPPERCASE_ACCENT_MAP[char] || char);
}

/**
 * Generates a URL-friendly slug from a text string.
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Formats a number as MXN currency.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a date string to a readable Mexican format.
 */
export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
