import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../assets/locales/en.json';
import hi from '../assets/locales/hi.json';
import mr from '../assets/locales/mr.json';

// Map stored locale values to i18next language codes
function storedLocaleToCode(stored: string | null): string {
  if (!stored) return 'en';
  if (stored.startsWith('hi')) return 'hi';
  if (stored.startsWith('mr')) return 'mr';
  return 'en';
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      mr: { translation: mr },
    },
    lng: storedLocaleToCode(localStorage.getItem('language')),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export default i18n;

