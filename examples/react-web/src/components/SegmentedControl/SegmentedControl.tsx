import { PILL_CLASS_NAME } from "src/styles/pillStyles";
import { segmentStyles } from "src/styles/segmentStyles";

type SegmentedControlProps<TOption extends string | number> = {
  label: string;
  options: ReadonlyArray<{ value: TOption; label: string }>;
  value: TOption;
  onSelect: (option: TOption) => void;
};

// Generic over the option, so a caller's setter keeps its own type; the one
// component on the page that cannot be a `React.FunctionComponent`.
export const SegmentedControl = <TOption extends string | number>({
  label,
  options,
  value,
  onSelect,
}: SegmentedControlProps<TOption>) => (
  <div role="group" aria-label={label} className={PILL_CLASS_NAME}>
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        aria-pressed={value === option.value}
        onClick={() => onSelect(option.value)}
        className={segmentStyles({ selected: value === option.value })}
      >
        {option.label}
      </button>
    ))}
  </div>
);
