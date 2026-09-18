import { useValue, useValueStatus } from "@priemskiyyy/silo-react";
import { Card } from "src/components/Card";
import { Choices } from "src/components/Choices";
import { ValueFeedback } from "src/components/ValueFeedback";
import { LanguageSchema, silo, ThemeSchema } from "src/silo/silo";

type PreferencesScreenProps = { userId: string };

export const PreferencesScreen = ({ userId }: PreferencesScreenProps) => {
  const themeHandle = silo.value("theme");
  const languageHandle = silo
    .scope("users")
    .scope(encodeURIComponent(userId))
    .value("language");
  const [theme, setTheme] = useValue(themeHandle);
  const [language, setLanguage] = useValue(languageHandle);
  const themeStatus = useValueStatus(themeHandle);
  const languageStatus = useValueStatus(languageHandle);

  return (
    <>
      <Card
        title="Appearance"
        description="One global preference, shared by every user and workspace on this device."
      >
        <Choices
          label="Theme"
          options={ThemeSchema.options}
          value={theme}
          onSelect={setTheme}
          disabled={themeStatus.state === "hydrating"}
        />
        <ValueFeedback handle={themeHandle} />
      </Card>
      <Card
        title={`${userId}'s preferences`}
        description="This user's language stays the same when you switch workspaces."
      >
        <Choices
          label="Language"
          options={LanguageSchema.options}
          value={language}
          onSelect={setLanguage}
          disabled={languageStatus.state === "hydrating"}
        />
        <ValueFeedback handle={languageHandle} />
      </Card>
    </>
  );
};
