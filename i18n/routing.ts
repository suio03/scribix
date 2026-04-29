import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "fr", "es", "it", "ja", "de"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});
