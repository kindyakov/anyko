import { hasSubmittedAttachments } from '@anyko/document-values/attachments';
import { inventoryCategories } from '@anyko/document-values/inventory-layout';

export function attachmentInstructions(
  fields: readonly { key: string; columns?: readonly { key: string }[] }[],
  section?: 'property' | 'attachments',
) {
  if (!hasSubmittedAttachments(fields)) return '';
  const categorize = fields.some(
    ({ key, columns }) =>
      key === 'realEstate' && columns?.some(({ key }) => key === 'category'),
  );
  const identify = fields.some(
    ({ key, columns }) =>
      key === 'realEstate' && columns?.some(({ key }) => key === 'identifier'),
  );
  const property = [
    'Для выписки ЕГРН заполни realEstate по объектам заявителя: вид, адрес, площадь, вид собственности и доля, основание, обременение. Дай отдельный кандидат и один точный фрагмент для каждого объекта с его адресом и кадастровым номером, если номер указан.',
    categorize ? 'В description приведи вид объекта из источника.' : '',
    ...Object.entries(inventoryCategories).flatMap(([field, choices]) =>
      fields.some(
        ({ key, columns }) =>
          key === field && columns?.some(({ key }) => key === 'category'),
      )
        ? [
            `Для ${field} в category выбери один из разделов: ${Object.keys(choices).join(', ')}. Цитата должна прямо подтверждать вид объекта. Если раздел определить нельзя, оставь category пустым.`,
          ]
        : [],
    ),
    identify
      ? 'Кадастровый номер объекта из выписки укажи в identifier с точной цитатой рядом с данными этого объекта. В description оставь вид и наименование. Не подставляй номер выписки или кадастровый номер другого объекта.'
      : '',
    'Не переноси характеристики из ЕГРН в propertyDetails, observations или другие текстовые абзацы заявления.',
  ];
  const attachments = [
    'Предложи отдельный кандидат attachments на каждый подтверждающий файл, с одной строкой и доказательствами из этого файла, включая паспорт, СНИЛС, ИНН, сведения о трудовой деятельности, справки о доходах и о размере задолженности, выписку ЕГРН.',
    'Укажи description (официальное наименование и реквизиты документа без пометки о виде экземпляра), category (egrn для ЕГРН, debtCertificate для подтверждения долга, pensionAccount для сведений о состоянии индивидуального лицевого счёта, procedureExpenses для чека расходов процедуры, trusteeRemuneration для оплаты вознаграждения финансовому управляющему, other в остальных случаях) и дословную цитату из этого файла. Уведомление АДИ-РЕГ о СНИЛС не относится к pensionAccount.',
    'В описании справки о размере задолженности приведи номер договора, дату выдачи справки и краткое наименование кредитора в творительном падеже, если реквизиты указаны. Процитируй заголовок и строки с реквизитами именно выданной справки. Различай дату выдачи справки и дату расчёта суммы. Различай расходы процедуры и вознаграждение.',
    'Не выводи вид подаваемого экземпляра по формату файла, видимой печати, подписи или отметке об электронной подписи. Состав и вид подаваемых экземпляров выбирает юрист. Не предлагай submittedAttachments.',
  ];
  const selected =
    section === 'property'
      ? property
      : section === 'attachments'
        ? attachments
        : [...property, ...attachments];
  return selected.filter(Boolean).join(' ');
}
