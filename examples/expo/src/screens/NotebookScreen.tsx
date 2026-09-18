import { useValue, useValueStatus } from "@priemskiyyy/silo-react";
import { useState } from "react";
import { Switch, Text, TextInput, View } from "react-native";
import { Button } from "src/components/Button";
import { Card } from "src/components/Card";
import { ValueFeedback } from "src/components/ValueFeedback";
import { silo } from "src/silo/silo";

type NotebookScreenProps = { workspaceId: string; userId: string };

const SAVE_LABELS = {
  idle: undefined,
  saving: "Saving…",
  saved: "Saved on this device",
  failed: "Save failed",
};

export const NotebookScreen = ({
  workspaceId,
  userId,
}: NotebookScreenProps) => {
  const workspace = silo
    .scope("workspaces")
    .scope(encodeURIComponent(workspaceId));
  const user = silo.scope("users").scope(encodeURIComponent(userId));
  const member = workspace.scope("users").scope(encodeURIComponent(userId));
  const draftHandle = workspace.value("draft");
  const pinnedHandle = member.value("pinned");
  const [draft, setDraft] = useValue(draftHandle);
  const [language] = useValue(user.value("language"));
  const [pinned, setPinned] = useValue(pinnedHandle);
  const status = useValueStatus(draftHandle);
  const pinStatus = useValueStatus(pinnedHandle);
  const [save, setSave] = useState<keyof typeof SAVE_LABELS>("idle");

  const handleSave = async () => {
    setSave("saving");
    try {
      if (draftHandle.status.get().state === "error") {
        draftHandle.set(draftHandle.get());
      }
      await draftHandle.flush();
      setSave("saved");
    } catch {
      setSave("failed");
    }
  };

  return (
    <>
      <Card
        title={`${workspaceId} draft`}
        description="Edits save to this device as you type. Switch workspaces to keep separate notes."
      >
        <TextInput
          accessibilityLabel="Workspace draft"
          placeholder="What would you like to remember?"
          placeholderTextColor="#71717a"
          multiline
          textAlignVertical="top"
          editable={status.state !== "hydrating" && save !== "saving"}
          value={draft}
          onChangeText={(text) => {
            setDraft(text);
            setSave("idle");
          }}
          className="min-h-44 rounded-2xl bg-zinc-50 p-4 text-base leading-6 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <View className="flex-row items-center justify-between gap-3">
          <Text
            accessibilityLiveRegion="polite"
            className="flex-1 text-sm text-zinc-500 dark:text-zinc-400"
          >
            {SAVE_LABELS[save] ?? `${draft.length} characters`}
          </Text>
          <Button
            label={save === "failed" ? "Retry save" : "Save now"}
            variant="primary"
            onPress={handleSave}
            disabled={status.state === "hydrating" || save === "saving"}
          />
        </View>
        <ValueFeedback handle={draftHandle} />
      </Card>
      <Card
        title={`${userId} in ${workspaceId}`}
        description="A preference for this person in this workspace. Other people and workspaces keep their own choice."
      >
        <View className="flex-row items-center justify-between gap-4">
          <Text className="flex-1 text-base text-zinc-800 dark:text-zinc-200">
            Pin this workspace
          </Text>
          <Switch
            accessibilityLabel="Pin this workspace"
            value={pinned}
            disabled={pinStatus.state === "hydrating"}
            onValueChange={setPinned}
            trackColor={{ true: "#f59e0b" }}
          />
        </View>
        <ValueFeedback handle={pinnedHandle} />
        <Text className="text-sm text-zinc-500 dark:text-zinc-400">
          {userId}'s language: {language}. Change it in Preferences; it follows
          this person across workspaces.
        </Text>
      </Card>
    </>
  );
};
