import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import arPlatformHome from '@/locales/ar/platform-home.json';
import enPlatformHome from '@/locales/en/platform-home.json';
import arHr from '@/locales/ar/hr.json';
import enHr from '@/locales/en/hr.json';
import arOperations from '@/locales/ar/operations.json';
import enOperations from '@/locales/en/operations.json';

const savedLanguage = localStorage.getItem('language') || 'ar';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ar: {
        platformHome: arPlatformHome,
        hr: arHr,
        operations: arOperations,
      },
      en: {
        platformHome: enPlatformHome,
        hr: enHr,
        operations: enOperations,
      },
    },
    lng: savedLanguage,
    fallbackLng: 'ar',
    ns: ['platformHome', 'hr', 'operations'],
    defaultNS: 'platformHome',
    interpolation: {
      escapeValue: false,
    },
  });

export const changeLanguage = (lang: 'ar' | 'en') => {
  i18n.changeLanguage(lang);
  localStorage.setItem('language', lang);
};

export const getCurrentLanguage = () => i18n.language as 'ar' | 'en';

export default i18n;
