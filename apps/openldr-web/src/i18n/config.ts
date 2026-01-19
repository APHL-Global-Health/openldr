import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpBackend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";

// Import translation files directly for bundling
import enCommon from "@/locales/en/common.json";
import enApp from "@/locales/en/app.json";
import swCommon from "@/locales/sw/common.json";
import swApp from "@/locales/sw/app.json";

const ENV = import.meta.env;

// Define available languages
export const SUPPORTED_LANGUAGES = ["en", "sw"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Define available namespaces
export const NAMESPACES = ["common", "app"] as const;
export type Namespace = (typeof NAMESPACES)[number];

const resources = {
  en: {
    common: enCommon,
    app: enApp,
  },
  sw: {
    common: swCommon,
    app: swApp,
  },
};

i18n
  // Load translation using http backend (for dynamic loading in production)
  // Comment out if you want to bundle all translations
  // .use(HttpBackend)

  // Detect user language
  .use(LanguageDetector)

  // Pass the i18n instance to react-i18next
  .use(initReactI18next)

  // Initialize i18next
  .init({
    resources,

    // Fallback language
    fallbackLng: "en",

    // Supported languages
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],

    // Default namespace
    defaultNS: "common",

    // Available namespaces
    ns: ["common", "app"],

    // Language to use if translations in user language are not available
    fallbackNS: "common",

    // Debug mode (set to false in production)
    debug: ENV.NODE_ENV === "development",

    // Interpolation options
    interpolation: {
      escapeValue: false, // React already escapes values
    },

    // Language detection options
    detection: {
      // Order of detection methods
      order: ["localStorage", "navigator", "htmlTag"],

      // Keys to look for in localStorage
      lookupLocalStorage: "i18nextLng",

      // Cache user language
      caches: ["localStorage"],
    },

    // Backend options (if using HttpBackend)
    backend: {
      loadPath: "/locales/{{lng}}/{{ns}}.json",
    },

    // React options
    react: {
      // Wait for translations to load before rendering
      useSuspense: true,
    },

    // Add resources to store
    load: "languageOnly",
  });

export default i18n;
