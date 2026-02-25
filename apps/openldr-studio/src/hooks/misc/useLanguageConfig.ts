import { useLanguage } from "@/i18n/hooks";
import { SUPPORTED_LANGUAGES } from "@/lib/constants";

// Hook to access language config
export function useLanguageConfig() {
  const { currentLanguage } = useLanguage();
  return SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage);
}
