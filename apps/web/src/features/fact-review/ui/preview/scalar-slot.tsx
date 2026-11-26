import type {
  DocumentPackage,
  DocumentTemplate,
  FieldKey,
  FieldValues,
} from '@anyko/contracts/catalog';
import { missingTemplateValue } from '@anyko/document-values/template-value';

import { TextSlot } from '../work-fields';

export function ScalarSlot({
  tag,
  fields,
  formats,
  values,
  displayValue,
  defaultText,
  disabled,
  suffix,
  onChange,
}: {
  tag: string;
  fields: DocumentPackage['fields'];
  formats: DocumentTemplate['placeholders'];
  values: FieldValues;
  displayValue: string | undefined;
  defaultText: string | undefined;
  disabled: boolean;
  suffix: string;
  onChange: (key: FieldKey, value: string | null) => void;
}) {
  const format = formats?.find((slot) => slot.tag === tag);
  const field = fields.find(({ key }) => key === (format?.field ?? tag));
  if ((!field || field.columns.length) && displayValue !== undefined)
    return displayValue + suffix;
  if (!field || field.columns.length)
    return (
      <span className="text-zinc-400">
        {missingTemplateValue}
        {suffix}
      </span>
    );
  const raw = values[field.key];
  const value = typeof raw === 'string' ? raw : (defaultText ?? null);
  return (
    <TextSlot
      fieldKey={field.key}
      label={field.label}
      hint={
        defaultText === undefined ? undefined : 'Текст шаблона по умолчанию'
      }
      maxLength={field.limits.maxLength}
      value={value}
      placeholder={
        displayValue === missingTemplateValue
          ? missingTemplateValue
          : field.label
      }
      displayValue={
        value === null && displayValue === missingTemplateValue
          ? undefined
          : displayValue
      }
      disabled={disabled}
      multiline={field.multiline}
      suffix={suffix}
      onChange={(next) => {
        onChange(field.key, next);
      }}
    />
  );
}
