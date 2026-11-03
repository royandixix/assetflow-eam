"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { Dictionary } from "@/locales/dictionary";

const DictionaryContext = createContext<Dictionary | null>(null);

type DictionaryProviderProps = {
  dictionary: Dictionary;
  children: ReactNode;
};

export function AssetFlowDictionaryProvider({
  dictionary,
  children,
}: DictionaryProviderProps) {
  return (
    <DictionaryContext.Provider value={dictionary}>
      {children}
    </DictionaryContext.Provider>
  );
}

export function useAssetFlowDictionary(): Dictionary {
  const dictionary = useContext(DictionaryContext);

  if (dictionary === null) {
    throw new Error(
      "useDictionary hook must be used within DictionaryProvider",
    );
  }

  return dictionary;
}
