import { Input } from "@/components/ui/input";

interface TemplateNameInputProps {
  value: string;
  onChange: (value: string) => void;
}

export default function TemplateNameInput({ value, onChange }: TemplateNameInputProps) {
  return (
    <div className="mt-2 max-w-md">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Template name"
      />
    </div>
  );
}