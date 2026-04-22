import { useTranslation as useI18nextTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, type Namespace } from "./config";

/**
 * Custom hook for common translations
 * Provides easy access to common namespace translations
 */
export function useCommonTranslation() {
  return useI18nextTranslation("common");
}

/**
 * Custom hook for app-specific translations
 * Provides easy access to app namespace translations
 */
export function useAppTranslation() {
  return useI18nextTranslation("app");
}

/**
 * Custom hook for multiple namespaces
 * Use when you need to access translations from multiple namespaces
 */
export function useMultiNamespaceTranslation(namespaces: Namespace[]) {
  return useI18nextTranslation(namespaces);
}

/**
 * Hook for dynamic namespaces (useful for extensions)
 * Use when namespace names are not known at compile time
 */
export function useDynamicTranslation(namespace: string | string[]) {
  return useI18nextTranslation(namespace as any);
}

/**
 * Hook to change language
 */
export function useLanguage() {
  const { i18n, ready } = useI18nextTranslation();

  const changeLanguage = async (lng: string) => {
    await i18n.changeLanguage(lng);
  };

  // Normalize language code (e.g., 'en-US' -> 'en')
  const normalizedLanguage = i18n.language?.split("-")[0] || "en";

  return {
    currentLanguage: i18n.language,
    normalizedLanguage,
    changeLanguage,
    languages: [...SUPPORTED_LANGUAGES],
    isReady: ready, // Whether translations are loaded
  };
}

/**
 * Hook for formatted dates with i18n support
 */
export function useFormattedDate() {
  const { i18n } = useI18nextTranslation();

  const formatDate = (
    date: Date | string,
    options?: Intl.DateTimeFormatOptions
  ) => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return new Intl.DateTimeFormat(i18n.language, options).format(dateObj);
  };

  const formatDateTime = (date: Date | string) => {
    return formatDate(date, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatShortDate = (date: Date | string) => {
    return formatDate(date, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return {
    formatDate,
    formatDateTime,
    formatShortDate,
  };
}

/**
 * Hook for formatted numbers with i18n support
 */
export function useFormattedNumber() {
  const { i18n } = useI18nextTranslation();

  const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => {
    return new Intl.NumberFormat(i18n.language, options).format(value);
  };

  const formatCurrency = (value: number, currency: string = "USD") => {
    return formatNumber(value, { style: "currency", currency });
  };

  const formatPercent = (value: number, decimals: number = 2) => {
    return formatNumber(value / 100, {
      style: "percent",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  return {
    formatNumber,
    formatCurrency,
    formatPercent,
  };
}
