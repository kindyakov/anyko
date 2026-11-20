import { hasSubmittedAttachments } from '@anyko/document-values/attachments';

export function attachmentInstructions(fields: readonly { key: string }[]) {
  if (!hasSubmittedAttachments(fields)) return '';
  return 'Для выписки ЕГРН заполни realEstate по объектам заявителя: вид, адрес, площадь, вид собственности и доля, основание, обременение. Дай отдельный кандидат и точную цитату для каждого объекта. Не переноси характеристики из ЕГРН в propertyDetails, observations или другие текстовые абзацы заявления. Для подтверждающих документов предложи attachments со строкой description (название и реквизиты источника без пометки о виде подаваемого экземпляра), category (egrn для ЕГРН, procedureExpenses для чека расходов процедуры, trusteeRemuneration для оплаты вознаграждения финансовому управляющему, other в остальных случаях) и цитатой с назначением. Различай расходы и вознаграждение. Не выводи вид подаваемого экземпляра по формату файла, видимой печати, подписи или отметке об электронной подписи. Состав и вид подаваемых экземпляров выбирает юрист. Не предлагай submittedAttachments.';
}
