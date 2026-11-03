
import "server-only";

import { cookies } from "next/headers";
import { Theme } from "@/themes/enum";

export const getPreferredTheme = async (): Promise<Theme> => {
  const cookieStore = await cookies();

  const preferredTheme = (
    cookieStore.get("preferred_theme")?.value ?? Theme.Auto
  ) as Theme;

  if (!Object.values(Theme).includes(preferredTheme)) {
    return Theme.Auto;
  }

  return preferredTheme;
};

export default async function getTheme(): Promise<Theme> {
  const cookieStore = await cookies();

  const theme = (
    cookieStore.get("theme")?.value ?? Theme.Light
  ) as Theme;

  if (theme !== Theme.Light && theme !== Theme.Dark) {
    return Theme.Light;
  }

  return theme;
}
