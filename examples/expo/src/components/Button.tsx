import { Pressable, Text } from "react-native";

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
};

export const Button = ({
  label,
  onPress,
  disabled = false,
  variant = "secondary",
}: ButtonProps) => (
  <Pressable
    accessibilityRole="button"
    aria-disabled={disabled}
    disabled={disabled}
    onPress={onPress}
    className={`min-h-12 items-center justify-center rounded-2xl px-4 py-3 ${variant === "primary" ? "bg-amber-500" : "bg-zinc-100 dark:bg-zinc-800"} ${disabled ? "opacity-40" : "active:opacity-70"}`}
  >
    <Text
      className={`text-sm font-semibold ${variant === "primary" ? "text-zinc-950" : "text-zinc-800 dark:text-zinc-100"}`}
    >
      {label}
    </Text>
  </Pressable>
);
