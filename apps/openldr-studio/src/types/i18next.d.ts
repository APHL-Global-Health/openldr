import "i18next";
import common from "@/locales/en/common.json";
import app from "@/locales/en/app.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      common: typeof common;
      app: typeof app;
    };
  }
}
