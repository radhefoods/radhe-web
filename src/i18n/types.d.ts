import type messages from "../../messages/en.json";
import type { routing } from "./routing";

// Makes translation keys and the locale type-checked: a key that is missing
// in messages/en.json is a compile error.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
