import React from "react";
import { useLanguage } from "@/i18n/hooks";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { SUPPORTED_LANGUAGES } from "@/lib/constants";

export const LanguageSwitcher: React.FC = () => {
  const { normalizedLanguage, changeLanguage, isReady } = useLanguage();

  const handleLanguageChange = async (langCode: string) => {
    await changeLanguage(langCode);
  };

  if (!isReady) {
    return <div className="language-switcher">Loading...</div>;
  }

  return (
    <div className="language-switcher">
      <Select
        onValueChange={(value: any) => handleLanguageChange(value)}
        value={normalizedLanguage}
      >
        <SelectTrigger className="flex flex-1 b-0 max-h-8 rounded-none border-none bg-transparent dark:bg-transparent">
          <SelectValue placeholder="" />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              {lang.flag} {lang.nativeName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
