import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import commonEn from "@/locales/en/common.json";
import landingEn from "@/locales/en/landing.json";
import practiceEn from "@/locales/en/practice.json";

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
      lng: "en",
      fallbackLng: "en",
      supportedLngs: ["en"],
      defaultNS: "common",
      ns: ["common", "landing", "practice"],
      resources: {
        en: {
          common: commonEn,
          landing: landingEn,
          practice: practiceEn,
        },
      },
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
      initImmediate: false,
    } as Parameters<typeof i18n.init>[0]);
}

export default i18n;