import { escapeSpreadsheetCsvCell } from './csv';

describe('escapeSpreadsheetCsvCell', () => {
  it.each(['=1+1', '+SUM(A1:A2)', '-2+3', '@SUM(A1:A2)', '\t=cmd', '\r+cmd']) (
    'neutralizes formula-shaped text: %p',
    (value) => expect(escapeSpreadsheetCsvCell(value)).toMatch(/^"?'\s*/u),
  );

  it('escapes quotes, commas, and line breaks using RFC 4180 quoting', () => {
    expect(escapeSpreadsheetCsvCell('Doe, "Jane"\nStudent')).toBe('"Doe, ""Jane""\nStudent"');
  });

  it('does not alter ordinary text or numeric scores', () => {
    expect(escapeSpreadsheetCsvCell('Jane Doe')).toBe('Jane Doe');
    expect(escapeSpreadsheetCsvCell(92)).toBe('92');
    expect(escapeSpreadsheetCsvCell(null)).toBe('');
  });
});
