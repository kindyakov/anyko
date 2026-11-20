import type {
  DocumentPackage,
  DocumentTemplate,
  FieldKey,
  FieldValues,
} from '@anyko/contracts/catalog';
import { formatTemplateValue } from '@anyko/document-values/template-value';

import { TextSlot } from '../work-fields';

export function ScalarSlot({
  tag,
  fields,
  formats,
  values,
  disabled,
  suffix,
  onChange,
}: {
  tag: string;
  fields: DocumentPackage['fields'];
  formats: DocumentTemplate['placeholders'];
  values: FieldValues;
  disabled: boolean;
  suffix: string;
  onChange: (key: FieldKey, value: string | null) => void;
}) {
  const format = formats?.find((slot) => slot.tag === tag);
  const field = fields.find(({ key }) => key === (format?.field ?? tag));
  if (!field || field.columns.length)
    return <span className="text-zinc-400">[не заполнено]{suffix}</span>;
  const raw = values[field.key];
  const value = typeof raw === 'string' ? raw : null;
  const displayValue =
    format && format.placeholder !== 'identity' && value !== null
      ? formatTemplateValue(value, format.placeholder)
      : undefined;
  return (
    <TextSlot
      fieldKey={field.key}
      label={field.label}
      maxLength={field.limits.maxLength}
      value={value}
      displayValue={displayValue}
      disabled={disabled}
      multiline={field.multiline}
      suffix={suffix}
      onChange={(next) => {
        onChange(field.key, next);
      }}
    />
  );
}
