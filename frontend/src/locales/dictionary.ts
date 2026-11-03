
import "server-only";

import { cookies } from "next/headers";
import { defaultLocale } from "@/locales/config";

const dictionaries = {
  en: () =>
    import("@/locales/en/lang.json").then(
      (module) => module.default
    ),
  ja: () =>
    import("@/locales/ja/lang.json").then(
      (module) => module.default
    ),
  zh: () =>
    import("@/locales/zh/lang.json").then(
      (module) => module.default
    )
};

export type Locale = keyof typeof dictionaries;

export type Dictionary = Awaited<
  ReturnType<typeof dictionaries.en>
>;

const fallbackLocale: Locale =
  defaultLocale in dictionaries
    ? (defaultLocale as Locale)
    : "en";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("locale")?.value;

  if (
    !localeCookie ||
    !Object.prototype.hasOwnProperty.call(dictionaries, localeCookie)
  ) {
    return fallbackLocale;
  }

  return localeCookie as Locale;
}

export async function getDictionary(): Promise<Dictionary> {
  const locale = await getLocale();
  const dictionary = await dictionaries[locale]();

  return dictionary as Dictionary;
}
