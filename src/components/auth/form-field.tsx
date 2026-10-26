"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type FormFieldProps = {
  id: string;
  label: string;
  error?: string;
  icon?: ReactNode;
  action?: ReactNode;
  helper?: ReactNode;
  helperId?: string;
  children: ReactNode;
};

export function FormField({ id, label, error, icon, action, helper, helperId, children }: FormFieldProps) {
  return (
    <Field className="field-group">
      <div className={action ? "label-row" : undefined}>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {action}
      </div>
      <div className={`input-wrap ${error ? "has-error" : ""}`}>
        {icon}
        {children}
      </div>
      {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
      {helper && <div id={helperId} className="field-helper">{helper}</div>}
    </Field>
  );
}

type FormPasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  id: string;
  label: string;
  error?: string;
  registration: UseFormRegisterReturn;
  action?: ReactNode;
  toggleable?: boolean;
  describedBy?: string;
  helper?: ReactNode;
  helperId?: string;
};

export function FormPasswordInput({
  id,
  label,
  error,
  registration,
  action,
  toggleable = true,
  describedBy,
  helper,
  helperId,
  ...inputProps
}: FormPasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <FormField id={id} label={label} error={error} icon={<LockKeyhole aria-hidden="true" size={18} />} action={action} helper={helper} helperId={helperId}>
      <Input
        id={id}
        type={visible ? "text" : "password"}
        aria-invalid={!!error}
        aria-describedby={[describedBy, error ? `${id}-error` : undefined].filter(Boolean).join(" ") || undefined}
        {...inputProps}
        {...registration}
      />
      {toggleable && (
        <button
          className="password-toggle"
          type="button"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      )}
    </FormField>
  );
}
