import type { ReactNode } from "react";
import { Text, View } from "react-native";

type CardProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export const Card = ({ title, description, children }: CardProps) => (
  <View className="gap-4 rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
    <View className="gap-1">
      <Text
        accessibilityRole="header"
        className="text-lg font-semibold text-zinc-950 dark:text-zinc-50"
      >
        {title}
      </Text>
      <Text className="text-sm leading-5 text-zinc-500 dark:text-zinc-400">
        {description}
      </Text>
    </View>
    {children}
  </View>
);
