import { useId, type ComponentPropsWithRef, type ReactNode } from 'react';

type FieldProps = {
  label: string;
  error?: string;
};

function Field({
  id,
  label,
  error,
  children,
}: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <p className="field__error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

function errorDescription(
  description: string | undefined,
  id: string,
  error?: string,
) {
  return (
    [description, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  );
}

export function TextField({
  label,
  error,
  id,
  'aria-describedby': description,
  'aria-invalid': invalid,
  ...props
}: FieldProps & ComponentPropsWithRef<'input'>) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <Field id={fieldId} label={label} error={error}>
      <input
        {...props}
        id={fieldId}
        aria-describedby={errorDescription(description, fieldId, error)}
        aria-invalid={error ? true : invalid}
      />
    </Field>
  );
}

export function Textarea({
  label,
  error,
  id,
  'aria-describedby': description,
  'aria-invalid': invalid,
  ...props
}: FieldProps & ComponentPropsWithRef<'textarea'>) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <Field id={fieldId} label={label} error={error}>
      <textarea
        {...props}
        id={fieldId}
        aria-describedby={errorDescription(description, fieldId, error)}
        aria-invalid={error ? true : invalid}
      />
    </Field>
  );
}
