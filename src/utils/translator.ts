import { LanguageCode, COMMON_VOCABULARY } from '../i18n';

/**
 * Perform real-time live dictionary translation for words
 * as the user types. Handles punctuation, casing, and phrases.
 */
export function translateLive(input: string, targetLang: LanguageCode): string {
  if (targetLang === 'en' || !input) {
    return input;
  }

  let result = input;

  // 1. First attempt multi-word phrase replacement (longest phrases first)
  const phrases = Object.keys(COMMON_VOCABULARY)
    .filter((k) => k.includes(' '))
    .sort((a, b) => b.length - a.length);

  for (const phrase of phrases) {
    const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
    const replacement = COMMON_VOCABULARY[phrase][targetLang];
    if (replacement) {
      result = result.replace(regex, replacement);
    }
  }

  // 2. Translate individual words while preserving whitespace and punctuation
  // Split input preserving tokens and delimiters
  const words = Object.keys(COMMON_VOCABULARY).filter((k) => !k.includes(' '));
  
  for (const word of words) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const replacement = COMMON_VOCABULARY[word][targetLang];
    if (replacement) {
      result = result.replace(regex, replacement);
    }
  }

  return result;
}

/**
 * Translate a single word right when space or punctuation is typed
 */
export function translateWord(word: string, targetLang: LanguageCode): string | null {
  if (targetLang === 'en') return null;
  const clean = word.toLowerCase().trim();
  const entry = COMMON_VOCABULARY[clean];
  if (entry && entry[targetLang]) {
    return entry[targetLang];
  }
  return null;
}
