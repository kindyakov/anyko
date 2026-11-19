BEGIN;

-- Identity retains the template's existing scalar, collection or computed binding.
-- A repeated column is scoped to its loop (for example, debts.amount).
WITH shared_statement(tags) AS (
  VALUES (ARRAY[
    'apartment', 'attachments', 'attachments.description', 'birthDate', 'birthPlace',
    'building', 'businessDebts', 'businessDebts.address', 'businessDebts.amount',
    'businessDebts.arrears', 'businessDebts.basis', 'businessDebts.inn', 'businessDebts.name',
    'businessDebts.ogrn', 'businessDebts.penalties', 'businessDebts.proof',
    'businessDebts.type', 'citizenship', 'city', 'companyParticipationDetails',
    'courtAddress', 'courtName', 'criminalCasesDetails', 'debtAsOfDate', 'debtTotal',
    'debtTotalWords', 'debts', 'debts.address', 'debts.amount', 'debts.arrears',
    'debts.basis', 'debts.inn', 'debts.name', 'debts.ogrn', 'debts.penalties', 'debts.proof',
    'debts.type', 'district', 'documentDate', 'documentNumber', 'employmentDetails',
    'familyDetails', 'firstName', 'house', 'inn', 'insolvencyDetails', 'lastName',
    'liabilityDetails', 'locality', 'majorTransactionsDetails', 'middleName',
    'passportDepartment', 'passportIssuedAt', 'passportIssuer', 'postalCode',
    'propertyDetails', 'region', 'requestsDetails', 'snils', 'sroAddress', 'sroContacts',
    'sroName', 'sroPostalAddress', 'street'
  ])
), explicit_bindings(template_version, tags) AS (
  VALUES
  ('technical-document-v1', ARRAY[
    'documentDate', 'documentNumber', 'observations', 'personName'
  ]),
  ('bfl-statement-v4', ARRAY[
    'signerName'
  ]),
  ('bfl-statement-v5', ARRAY[
    'passportIssuedAtText', 'signerName'
  ]),
  ('bfl-inventory-v1', ARRAY[
    'accounts', 'accounts.amount', 'accounts.name', 'accounts.openedAt', 'accounts.rowNumber',
    'accounts.type', 'apartment', 'birthDate', 'birthPlace', 'building', 'city', 'district',
    'documentDate', 'documentNumber', 'equity', 'equity.address', 'equity.amount',
    'equity.basis', 'equity.name', 'equity.rowNumber', 'equity.share', 'firstName', 'house',
    'inn', 'lastName', 'locality', 'middleName', 'previousNames', 'realEstate',
    'realEstate.address', 'realEstate.area', 'realEstate.basis', 'realEstate.description',
    'realEstate.ownership', 'realEstate.pledge', 'realEstate.rowNumber', 'region',
    'securities', 'securities.amount', 'securities.name', 'securities.nominal',
    'securities.quantity', 'securities.rowNumber', 'securities.type', 'snils', 'street',
    'valuables', 'valuables.address', 'valuables.amount', 'valuables.description',
    'valuables.pledge', 'valuables.rowNumber', 'vehicles', 'vehicles.address',
    'vehicles.amount', 'vehicles.description', 'vehicles.identifier', 'vehicles.ownership',
    'vehicles.pledge', 'vehicles.rowNumber'
  ]),
  ('bfl-creditors-v1', ARRAY[
    'apartment', 'birthDate', 'birthPlace', 'building', 'businessDebts',
    'businessDebts.address', 'businessDebts.amount', 'businessDebts.arrears',
    'businessDebts.basis', 'businessDebts.name', 'businessDebts.penalties',
    'businessDebts.rowNumber', 'businessDebts.type', 'businessPayments',
    'businessPayments.amount', 'businessPayments.name', 'businessPayments.penalties',
    'businessPayments.rowNumber', 'businessReceivables', 'businessReceivables.address',
    'businessReceivables.amount', 'businessReceivables.arrears', 'businessReceivables.basis',
    'businessReceivables.name', 'businessReceivables.penalties',
    'businessReceivables.rowNumber', 'businessReceivables.type', 'businessRefunds',
    'businessRefunds.amount', 'businessRefunds.name', 'businessRefunds.penalties',
    'businessRefunds.rowNumber', 'city', 'debts', 'debts.address', 'debts.amount',
    'debts.arrears', 'debts.basis', 'debts.name', 'debts.penalties', 'debts.rowNumber',
    'debts.type', 'district', 'documentDate', 'documentNumber', 'firstName', 'house', 'inn',
    'lastName', 'locality', 'mandatoryPayments', 'mandatoryPayments.amount',
    'mandatoryPayments.name', 'mandatoryPayments.penalties', 'mandatoryPayments.rowNumber',
    'middleName', 'previousNames', 'receivables', 'receivables.address', 'receivables.amount',
    'receivables.arrears', 'receivables.basis', 'receivables.name', 'receivables.penalties',
    'receivables.rowNumber', 'receivables.type', 'refunds', 'refunds.amount', 'refunds.name',
    'refunds.penalties', 'refunds.rowNumber', 'region', 'snils', 'street'
  ])
), bindings(template_version, tag) AS (
  SELECT 'bfl-statement-v' || version, unnest(tags)
  FROM generate_series(1, 5) AS versions(version)
  CROSS JOIN shared_statement
  UNION ALL
  SELECT template_version, unnest(tags)
  FROM explicit_bindings
)
INSERT INTO "DocumentTemplatePlaceholder" ("templateVersion", "tag", "field", "placeholder")
SELECT template_version, tag, tag, 'identity'
FROM bindings
ON CONFLICT ("templateVersion", "tag") DO NOTHING;

ALTER TABLE "DocumentTemplatePlaceholder"
  DROP CONSTRAINT "DocumentTemplatePlaceholder_templateVersion_fkey",
  ADD CONSTRAINT "DocumentTemplatePlaceholder_templateVersion_fkey"
  FOREIGN KEY ("templateVersion") REFERENCES "DocumentTemplateVersion"("version")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
