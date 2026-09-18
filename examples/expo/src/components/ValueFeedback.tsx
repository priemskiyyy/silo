import type { SiloValue } from "@priemskiyyy/silo";
import { useValueStatus } from "@priemskiyyy/silo-react";
import { useState } from "react";
import { Text, View } from "react-native";
import { Button } from "src/components/Button";

type ValueFeedbackProps<TValue> = {
  handle: SiloValue<TValue>;
};

export const ValueFeedback = <TValue,>({
  handle,
}: ValueFeedbackProps<TValue>) => {
  const status = useValueStatus(handle);
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (status.state !== "error" || retrying) {
      return;
    }
    setRetrying(true);
    try {
      if (status.error.phase === "write") {
        handle.set(handle.get());
        await handle.flush();
        return;
      }
      await handle.reload();
    } catch {
      // The value status retains the failure for another retry.
    } finally {
      setRetrying(false);
    }
  };

  if (status.state === "hydrating") {
    return (
      <Text accessibilityLiveRegion="polite" className="text-sm text-zinc-500">
        Loading saved value…
      </Text>
    );
  }
  if (status.state !== "error") {
    return null;
  }
  return (
    <View className="gap-2 rounded-2xl bg-rose-50 p-3 dark:bg-rose-950/40">
      <Text
        accessibilityRole="alert"
        className="text-sm text-rose-800 dark:text-rose-200"
      >
        {status.error.phase === "write"
          ? "Could not save. Your edit is still available in this session."
          : "Could not load the stored value. The stored data has not been deleted."}
      </Text>
      <Button
        label={retrying ? "Retrying…" : "Retry"}
        onPress={handleRetry}
        disabled={retrying}
      />
    </View>
  );
};
