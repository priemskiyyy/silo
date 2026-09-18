import { useValue } from "@priemskiyyy/silo-react";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Uniwind, withUniwind } from "uniwind";
import { Choices } from "src/components/Choices";
import { Navigation } from "src/components/Navigation";
import { NotebookScreen } from "src/screens/NotebookScreen";
import { PreferencesScreen } from "src/screens/PreferencesScreen";
import { StorageScreen } from "src/screens/StorageScreen";
import { silo } from "src/silo/silo";
import "src/global.css";

const StyledSafeAreaView = withUniwind(SafeAreaView);

export const Application = () => {
  const [screen, setScreen] = useState<"notebook" | "preferences" | "storage">(
    "notebook",
  );
  const [workspaceId, setWorkspaceId] = useState("Alpine");
  const [userId, setUserId] = useState("Ada");
  const [backgroundError, setBackgroundError] = useState("");
  const [theme] = useValue(silo.value("theme"));

  useEffect(() => {
    Uniwind.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        return;
      }
      // Backgrounding can be brief; every edit already starts its own write.
      silo.flush().then(
        () => setBackgroundError(""),
        () =>
          setBackgroundError(
            "A write failed while leaving the app. Open the affected screen to retry.",
          ),
      );
    });
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StyledSafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950">
        <StatusBar
          style={
            theme === "system" ? "auto" : theme === "dark" ? "light" : "dark"
          }
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="mx-auto w-full max-w-2xl gap-5 px-5 pt-5 pb-8"
          >
            <View className="gap-2">
              <Text className="text-xs font-semibold tracking-widest text-amber-700 uppercase dark:text-amber-400">
                Silo · Expo
              </Text>
              <Text
                accessibilityRole="header"
                className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50"
              >
                Fieldbook
              </Text>
              <Text className="text-base leading-6 text-zinc-500 dark:text-zinc-400">
                Your notes and preferences, kept on this device.
              </Text>
            </View>
            <View className="gap-4">
              <Choices
                label="Workspace"
                options={["Alpine", "Coast"]}
                value={workspaceId}
                onSelect={setWorkspaceId}
              />
              <Choices
                label="Demo user"
                options={["Ada", "Grace"]}
                value={userId}
                onSelect={setUserId}
              />
            </View>
            {backgroundError === "" ? null : (
              <Text
                accessibilityRole="alert"
                className="text-sm text-rose-700 dark:text-rose-300"
              >
                {backgroundError}
              </Text>
            )}
            <View key={`${workspaceId}:${userId}`} className="gap-4">
              {screen === "notebook" ? (
                <NotebookScreen workspaceId={workspaceId} userId={userId} />
              ) : null}
              {screen === "preferences" ? (
                <PreferencesScreen userId={userId} />
              ) : null}
              {screen === "storage" ? (
                <StorageScreen workspaceId={workspaceId} userId={userId} />
              ) : null}
            </View>
            <Text className="text-center text-xs leading-5 text-zinc-400 dark:text-zinc-500">
              Demo identities organize local data. They do not sign anyone in.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
        <Navigation screen={screen} onSelect={setScreen} />
      </StyledSafeAreaView>
    </SafeAreaProvider>
  );
};
