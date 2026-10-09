/**
 * True for a phone number or any run of digits with separators ("03-372-4722", "+972 54 123 4567"). Such a run must stay
 * on one line: a Hebrew line would otherwise split "054-" from "1234567" at the hyphen. Email addresses are not number-like.
 */
export const isNumberLike = (text: string): boolean => /^[+(]?\d[\d\s\-().]*$/.test(text.trim());
