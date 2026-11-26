import { hasEmploymentFields } from '@anyko/document-values/employment';
import {
  creditorRegistryColumns,
  obligationFields,
} from '@anyko/document-values/obligations';

import type {
  AgentPolicy,
  CourtEvidence,
  CreditorEvidence,
} from '../agent-policy';

import { attachmentInstructions } from './attachment-instructions';
import { automaticValue } from './automatic-value';
import { businessAbsenceRule } from './business-absence';
import { employmentInstructions } from './employment-instructions';
import { factInstructions } from './fact-instructions';
import { obligationInstructions } from './obligation-instructions';

const court: CourtEvidence = {
  name: 'courtName',
  address: 'courtAddress',
  region: 'region',
  addresses: ['registrationAddress', 'city', 'locality'],
};
const creditor: CreditorEvidence = {
  fields: obligationFields,
  primaryRegistry: 'cbr',
  fallbackRegistry: 'fns',
};

export const bflAgentPolicy: AgentPolicy = {
  extraction: (available) =>
    `${factInstructions(available, { extraction: true })} Не смешивай сведения разных людей; отличай должника-заявителя от кредитора, ребёнка и представителя. Денежные суммы сохраняй десятичными строками, не считай итоги и не выводи суммы прописью самостоятельно. Просительную часть не сочиняй: только явно приведённый текст. Правовые нормы не являются сведениями о конкретном человеке. Не заполняй неизвестное и не додумывай. Конфликтующие значения сохрани отдельными кандидатами. ${obligationInstructions(available)} ${employmentInstructions(available)} ${attachmentInstructions(available)}`,
  reconciliation: (available, withChecklist) =>
    `Для кредитора сохраняй точное название юридического лица из справки или договора. Если в источнике рядом с названием указан ИНН или ОГРН кредитора, добавь этот реквизит в строку обязательства и его цитату в evidence. Сведения заемщика к кредитору не относятся. Реквизиты из реестра сервер проверяет отдельно.
Когда доступны поля суда и адрес места жительства заявителя, вызови lookupArbitrationCourt для каждого обоснованного субъекта РФ. Если источники расходятся, проверь все варианты. Передавай только наименование субъекта РФ. Если субъект выводится из названия населённого пункта, верни подтверждённый инструментом вариант courtName с объяснением связи населённого пункта и субъекта, а в evidence укажи точную цитату исходного кандидата region, registrationAddress, city или locality. Реквизиты суда вне официального поиска возвращай только при прямом указании в исходном документе.
${obligationInstructions(available)} ${employmentInstructions(available)} ${attachmentInstructions(available)} ${factInstructions(available)}${withChecklist ? ' Оборот, лимит и остаток по счёту сами по себе не делают выписку справкой о задолженности.' : ''}`,
  chat: (inputFields) =>
    `${hasEmploymentFields(inputFields) ? 'Для вопроса о работе или средней зарплате прочитай employmentIncome через readField. Используй результат employment для статуса, периода, суммы до налога и средней зарплаты. Объясни, что сервер делит сумму начислений до налога по всем отработанным месяцам текущего года на число этих месяцев и уменьшает результат на 13%. При смене работы выплаты обоих работодателей входят в сумму, а неполный месяц считается целым. При нехватке данных укажи, что нужно сверить.' : ''} Для вопроса о подсудности из места жительства выдели только субъект РФ и передай его в lookupArbitrationCourt. Укажи основание, официальные ссылки и дату проверки. При нескольких вариантах покажи их пользователю. Сохраняй реквизиты суда только после явного выбора пользователя или однозначного результата официального инструмента по его поручению. По просьбе о проверке кредитора используй lookupCreditorRegistry для названия, ИНН или ОГРН юридического лица из документов работы. Для банка и МФО используй Банк России, для других юрлиц используй ФНС. Покажи полное и краткое названия, доступные реквизиты, адрес, официальную ссылку и дату проверки. При нескольких или неполных совпадениях покажи варианты. При недоступности сохрани текущие сведения и назови исходный документ. Для реквизитов кредитора из реестра требуется явный выбор пользователя в проверке полей.`,
  modelFields: {
    serverFields: ['submittedAttachments'],
    serverColumns: Object.keys(creditorRegistryColumns),
  },
  lookups: {
    reconciliation: { court, creditor },
    chat: { court, creditor },
    steps: {
      registration: { court },
      obligations: { creditor },
    },
  },
  courtInferenceFields: [court.name, court.address],
  stepEvidence: {
    revision: 'business-absence-1',
    needsSourceText: ({ origin, value, field }) =>
      origin === 'document' &&
      Array.isArray(value) &&
      value.length === 0 &&
      !!businessAbsenceRule(field),
    rejection: (candidate, sources) =>
      automaticValue(candidate, { sources }) === null
        ? 'business_absence_not_supported'
        : undefined,
  },
};
