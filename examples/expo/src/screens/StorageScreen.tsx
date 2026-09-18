import { useValue, useValueStatus } from "@priemskiyyy/silo-react";
import { useState } from "react";
import { Text, View } from "react-native";
import { Button } from "src/components/Button";
import { Card } from "src/components/Card";
import { ValueFeedback } from "src/components/ValueFeedback";
import { silo } from "src/silo/silo";

type StorageScreenProps = { workspaceId: string; userId: string };

export const StorageScreen = ({ workspaceId, userId }: StorageScreenProps) => {
  const tokenHandle = silo
    .scope("users")
    .scope(encodeURIComponent(userId))
    .value("secure.token");
  const [token] = useValue(tokenHandle);
  const tokenStatus = useValueStatus(tokenHandle);
  const [operation, setOperation] = useState<
    "idle" | "saving" | "removing" | "releasing"
  >("idle");
  const [message, setMessage] = useState("");
  const secureAdapter = silo.diagnostics
    .get()
    .storages.find((storage) => storage.name === "secure")?.adapter;

  const handleTokenChange = async (next: string | undefined) => {
    setOperation(next === undefined ? "removing" : "saving");
    setMessage("");
    try {
      tokenHandle.set(next);
      await tokenHandle.flush();
      setMessage(
        next === undefined ? "Demo token removed." : "Demo token saved.",
      );
    } catch {
      setMessage("The token change could not be saved.");
    } finally {
      setOperation("idle");
    }
  };

  const handleRelease = async () => {
    setOperation("releasing");
    setMessage("");
    try {
      await silo
        .scope("workspaces")
        .scope(encodeURIComponent(workspaceId))
        .release();
      setMessage(
        `${workspaceId}'s cached values were released. Open Notebook to load them from storage again.`,
      );
    } catch {
      setMessage(
        "Could not release this workspace because a write failed. Your cached edits are still available.",
      );
    } finally {
      setOperation("idle");
    }
  };

  return (
    <>
      <Card
        title={`${userId}'s demo token`}
        description={
          secureAdapter === "memory"
            ? "This web preview keeps the token in memory. On iOS and Android, it uses Expo SecureStore."
            : "Stored with Expo SecureStore on this device. This is a fixed demo value, not a real sign-in token."
        }
      >
        <Text className="text-base font-medium text-zinc-800 dark:text-zinc-100">
          {token === undefined ? "No demo token" : "Demo token present"}
        </Text>
        <View className="gap-2">
          <Button
            label="Save demo token"
            variant="primary"
            onPress={() => handleTokenChange("fieldbook-demo-token")}
            disabled={operation !== "idle" || tokenStatus.state === "hydrating"}
          />
          <Button
            label="Remove demo token"
            onPress={() => handleTokenChange(undefined)}
            disabled={operation !== "idle" || token === undefined}
          />
        </View>
        <ValueFeedback handle={tokenHandle} />
      </Card>
      <Card
        title="Free cached workspace values"
        description="Release waits for pending writes, then frees cached records. It does not delete saved notes or close storage."
      >
        <Button
          label={
            operation === "releasing"
              ? "Releasing…"
              : `Release ${workspaceId} cache`
          }
          onPress={handleRelease}
          disabled={operation !== "idle"}
        />
      </Card>
      <Text
        accessibilityLiveRegion="polite"
        className="text-sm leading-5 text-zinc-600 dark:text-zinc-300"
      >
        {message}
      </Text>
    </>
  );
};
