const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

export function faDigits(n: number | string): string {
  return String(n).replace(/\d/g, (d) => FA_DIGITS[Number(d)] ?? d)
}
