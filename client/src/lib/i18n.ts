import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import arPlatformHome from '@/locales/ar/platform-home.json';
import enPlatformHome from '@/locales/en/platform-home.json';

const savedLanguage = localStorage.getItem('language') || 'ar';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ar: {
        platformHome: arPlatformHome,
      },
      en: {
        platformHome: enPlatformHome,
      },
    },
    lng: savedLanguage,
    fallbackLng: 'ar',
    ns: ['platformHome'],
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
