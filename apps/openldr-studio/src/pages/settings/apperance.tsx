import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Circle, CircleDot } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { useId } from "react";
import { useMultiNamespaceTranslation } from "@/i18n/hooks";

import ui_light from "@/assets/images/ui-light.png";
import ui_dark from "@/assets/images/ui-dark.png";
// import ui_system from "@/assets/images/ui-system.png";
import { getCurrentTheme, handleThemeChange } from "@/lib/theme";

export function SettingsAppearance() {
  const { t } = useMultiNamespaceTranslation(["common", "app"]);
  const items = [
    {
      id: "radio-appearance-light",
      value: "light",
      label: t("common:theme.light"),
      image: ui_light,
    },
    {
      id: "radio-appearance-dark",
      value: "dark",
      label: t("common:theme.dark"),
      image: ui_dark,
    },
    // {
    //   id: "radio-appearance-system",
    //   value: "system",
    //   label: "System",
    //   image: ui_system,
    // },
  ];

  const id = useId();
  const theme = localStorage.getItem("theme") || getCurrentTheme();

  return (
    <div className="flex w-full h-full justify-center overflow-y-auto pt-4">
      <Card className="w-3xl h-60 rounded-sm">
        <CardHeader>
          <CardTitle>{t("app:settings.appearance")}</CardTitle>
          <CardDescription></CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="flex py-4">
          <div className="flex flex-1 flex-row justify-between space-x-4">
            <div className="text-sm font-medium leading-none text-foreground">
              {t("common:theme.choose_theme")}
            </div>
            <RadioGroup
              className="flex gap-3"
              onValueChange={handleThemeChange}
              defaultValue={theme}
            >
              {items.map((item) => (
                <label key={`${id}-${item.value}`}>
                  <RadioGroupItem
                    id={`${id}-${item.value}`}
                    value={item.value}
                    className="peer sr-only after:absolute after:inset-0"
                  />
                  <img
                    src={item.image}
                    alt={item.label}
                    width={88}
                    height={70}
                    className="relative cursor-pointer overflow-hidden rounded-lg border border-input shadow-sm shadow-black/5 outline-offset-2 transition-colors peer-focus:outline-2 peer-focus:outline-ring/70 peer-data-disabled:cursor-not-allowed peer-data-[state=checked]:border-ring peer-data-[state=checked]:bg-accent peer-data-disabled:opacity-50"
                  />
                  <span className="group mt-2 flex items-center gap-1 peer-data-[state=unchecked]:text-foreground-default/50">
                    <CircleDot
                      size={16}
                      strokeWidth={2}
                      className="peer-data-[state=unchecked]:group-[]:hidden"
                      aria-hidden="true"
                    />
                    <Circle
                      size={16}
                      strokeWidth={2}
                      className="peer-data-[state=checked]:group-[]:hidden"
                      aria-hidden="true"
                    />
                    <span className="text-xs font-medium">{item.label}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
