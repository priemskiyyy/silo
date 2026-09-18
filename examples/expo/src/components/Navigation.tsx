import { Pressable, Text, View } from "react-native";
import { useUniwind } from "uniwind";
import Svg, { Path } from "react-native-svg";

type NavigationProps = {
  screen: "notebook" | "preferences" | "storage";
  onSelect: (screen: NavigationProps["screen"]) => void;
};

const SCREENS = [
  {
    id: "notebook",
    label: "Notebook",
    path: "M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6V3Zm-3 4h5M3 12h5M3 17h5M11 7h5M11 11h5",
  },
  {
    id: "preferences",
    label: "Preferences",
    path: "M4 7h16M4 17h16M8 4v6M16 14v6",
  },
  {
    id: "storage",
    label: "Storage",
    path: "M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5V10Zm7 4v3",
  },
] satisfies {
  id: NavigationProps["screen"];
  label: string;
  path: string;
}[];

export const Navigation = ({ screen, onSelect }: NavigationProps) => {
  const { theme } = useUniwind();

  return (
    <View className="flex-row border-t border-zinc-200 bg-white px-3 pt-2 dark:border-zinc-800 dark:bg-zinc-900">
      {SCREENS.map(({ id, label, path }) => (
        <Pressable
          key={id}
          accessibilityRole="tab"
          accessibilityLabel={label}
          aria-selected={screen === id}
          onPress={() => onSelect(id)}
          className={`min-h-16 flex-1 items-center justify-center gap-1 rounded-2xl ${screen === id ? "bg-amber-50 dark:bg-amber-950" : "active:bg-zinc-100 dark:active:bg-zinc-800"}`}
        >
          <Svg
            width={22}
            height={22}
            viewBox="0 0 24 24"
            fill="none"
            stroke={
              screen === id
                ? "#d97706"
                : theme === "dark"
                  ? "#a1a1aa"
                  : "#71717a"
            }
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <Path d={path} />
          </Svg>
          <Text
            className={`text-xs font-medium ${screen === id ? "text-amber-800 dark:text-amber-200" : "text-zinc-500 dark:text-zinc-400"}`}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};
