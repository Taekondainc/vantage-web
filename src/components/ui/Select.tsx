import * as RadixSelect from "@radix-ui/react-select";
import type { ReactNode } from "react";

export type SelectOption = { value: string; label: string };

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  placeholder?: string;
  "aria-label": string;
  className?: string;
};

function Chevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function Select({
  value,
  onValueChange,
  options,
  disabled,
  placeholder,
  "aria-label": ariaLabel,
  className = "",
}: Props) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RadixSelect.Trigger className={`radix-select-trigger ${className}`.trim()} aria-label={ariaLabel}>
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon className="radix-select-icon">
          <Chevron />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content className="radix-select-content" position="popper" sideOffset={4}>
          <RadixSelect.Viewport className="radix-select-viewport">
            {options.map((option) => (
              <Item key={option.value} value={option.value}>
                {option.label}
              </Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

function Item({ value, children }: { value: string; children: ReactNode }) {
  return (
    <RadixSelect.Item value={value} className="radix-select-item">
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator className="radix-select-indicator">✓</RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  );
}
