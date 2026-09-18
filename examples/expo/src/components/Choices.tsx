import { Pressable, Text, View } from "react-native";

type ChoicesProps<TValue extends string> = {
  label: string;
  options: TValue[];
  value: TValue;
  onSelect: (value: TValue) => void;
  disabled?: boolean;
};

export const Choices = <TValue extends string>({
  label,
  options,
  value,
  onSelect,
  disabled = false,
}: ChoicesProps<TValue>) => (
  <View className="gap-2">
    <Text className="text-xs font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
      {label}
    </Text>
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      className="flex-row flex-wrap gap-2"
    >
      {options.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="radio"
          accessibilityLabel={`${label}: ${option}`}
          aria-checked={option === value}
          aria-disabled={disabled}
          disabled={disabled}
          onPress={() => onSelect(option)}
          className={`min-h-12 flex-1 items-center justify-center rounded-2xl border px-4 py-3 ${option === value ? "border-amber-500 bg-amber-50 dark:bg-amber-950" : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"} ${disabled ? "opacity-40" : "active:opacity-70"}`}
        >
          <Text
            className={`text-sm font-medium capitalize ${option === value ? "text-amber-900 dark:text-amber-200" : "text-zinc-600 dark:text-zinc-300"}`}
          >
            {option}
          </Text>
        </Pressable>
      ))}
    </View>
  </View>
);
