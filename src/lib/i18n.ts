import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import commonEn from "@/locales/en/common.json";
import landingEn from "@/locales/en/landing.json";

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      lng: "en",
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
      initImmediate: false,
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
}

export default i18n;