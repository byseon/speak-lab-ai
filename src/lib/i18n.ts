import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import commonEn from "@/locales/en/common.json";
import landingEn from "@/locales/en/landing.json";

if (!i18n.isInitialized) {
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      fallbackLng: "en",
      supportedLngs: ["en"],
      defaultNS: "common",
      ns: ["common", "landing"],
      resources: {
        en: {
          common: commonEn,
          landing: landingEn,
        },
      },
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
}

export default i18n;