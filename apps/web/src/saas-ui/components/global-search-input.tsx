import { Search } from "lucide-react";
import { Icon, Input, InputGroup } from "@saas-ui/react";

export type SearchInputProps = {
  readonly onChange: (value: string) => void;
  readonly value: string;
};

// Adapted from saas-js/tanstack-start-starter-kit-pro@b76cb4514b9ab47f7db87901cb9b593b4adc3129
// apps/web/src/features/common/components/global-search-input.tsx.
export function SearchInput({ onChange, value }: SearchInputProps) {
  return (
    <InputGroup startElement={<Icon as={Search} />}>
      <Input
        aria-keyshortcuts="/"
        aria-label="Search routes"
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder="Search routes"
        value={value}
      />
    </InputGroup>
  );
}

export const GlobalSearchInput = SearchInput;
