import type {
  DocumentPackage,
  DocumentTemplate,
  FieldKey,
  FieldValues,
} from '@anyko/contracts/catalog';
import {
  formatBankruptcyMoney,
  formatBankruptcyScalar,
} from '@anyko/document-values/bankruptcy-format';
import { hasEmploymentFields } from '@anyko/document-values/employment';
import { formatTemplateValue } from '@anyko/document-values/template-value';

import { TextSlot } from '../work-fields';

export function ScalarSlot({
  tag,
  fields,
  formats,
  values,
  modern,
  defaultText,
  translatedText,
  disabled,
  suffix,
  onChange,
}: {
  tag: string;
  fields: DocumentPackage['fields'];
  formats: DocumentTemplate['placeholders'];
  values: FieldValues;
  modern: boolean;
  defaultText: string | undefined;
  translatedText: ((key: string, value: string) => string) | undefined;
  disabled: boolean;
  suffix: string;
  onChange: (key: FieldKey, value: string | null) => void;
}) {
  const format = formats?.find((slot) => slot.tag === tag);
  const field = fields.find(({ key }) => key === (format?.field ?? tag));
  if (!field && tag === 'employmentDetails' && hasEmploymentFields(fields)) {
    const text = values[tag];
    return (
      <span>
        {typeof text === 'string' ? text : '[не заполнено]'}
        {suffix}
      </span>
    );
  }
  if (!field || field.columns.length)
    return <span className="text-zinc-400">[не заполнено]{suffix}</span>;
  const raw = values[field.key];
  const value = typeof raw === 'string' ? raw : (defaultText ?? null);
  const displayValue =
    format && format.placeholder !== 'identity' && value !== null
      ? modern && format.placeholder === 'RUB_DECIMAL'
        ? formatBankruptcyMoney(value)
        : formatTemplateValue(value, format.placeholder)
      : modern && value !== null
        ? formatBankruptcyScalar(
            field.key,
            translatedText?.(field.key, value) ?? value,
          )
        : undefined;
  return (
    <TextSlot
      fieldKey={field.key}
      label={field.label}
      hint={
        defaultText === undefined ? undefined : 'Текст шаблона по умолчанию'
      }
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
