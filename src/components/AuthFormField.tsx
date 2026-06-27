import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type AuthFormFieldProps = {
  id: string;
  label: string;
  error?: string;
  type?: ComponentProps<typeof Input>["type"];
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
};

export function AuthFormField({
  id,
  label,
  error,
  type = "text",
  autoComplete,
  minLength,
  required,
  value,
  onChange,
}: AuthFormFieldProps) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={error ? "text-destructive" : undefined}>
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        minLength={minLength}
        required={required}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={cn(
          error &&
            "border-destructive focus-visible:ring-destructive/40 aria-invalid:border-destructive",
        )}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <p id={errorId} role="alert" aria-live="polite" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function AuthFormAlert({ message, id = "form-error" }: { message: string; id?: string }) {
  return (
    <p
      id={id}
      role="alert"
      aria-live="polite"
      className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </p>
  );
}
