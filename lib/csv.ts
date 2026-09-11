/**
 * Encode an untrusted value as one CSV cell without allowing spreadsheet
 * software to interpret it as a formula. Delimiters are escaped after the
 * formula guard so the leading apostrophe is inside the quoted value.
 */
export function escapeSpreadsheetCsvCell(value: string | number | null | undefined): string {
  if (value == null) return '';

  let text = String(value);
  if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`;

  return /[",\r\n]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}
