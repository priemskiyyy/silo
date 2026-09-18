import AsyncStorage from "@react-native-async-storage/async-storage";
import { Silo, value } from "@priemskiyyy/silo";
import { asyncStorage } from "@priemskiyyy/silo-async-storage";
import { secureStore } from "@priemskiyyy/silo-expo-secure-store";
import { memory } from "@priemskiyyy/silo-memory";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { z } from "zod";

export const ThemeSchema = z.enum(["system", "light", "dark"]);
export const LanguageSchema = z.enum(["English", "Deutsch"]);

export const silo = new Silo({
  namespace: "fieldbook-mobile",
  storages: {
    default: {
      adapters: [asyncStorage({ storage: AsyncStorage })],
      schema: {
        theme: value({ schema: ThemeSchema, fallback: "system" }),
        draft: value({ schema: z.string(), fallback: "" }),
        language: value({ schema: LanguageSchema, fallback: "English" }),
        pinned: value({ schema: z.boolean(), fallback: false }),
      },
    },
    secure: {
      adapters: [
        secureStore({
          store: SecureStore,
          available: () => Platform.OS === "ios" || Platform.OS === "android",
        }),
        memory(),
      ],
      schema: { token: value({ schema: z.string() }) },
    },
  },
});
