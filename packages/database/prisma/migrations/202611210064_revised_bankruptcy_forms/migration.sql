BEGIN;

INSERT INTO "DocumentPackageVersion" ("version", "packageId", "title")
SELECT revisions.version, previous."packageId", previous."title"
FROM "DocumentPackageVersion" previous
CROSS JOIN unnest(ARRAY['bfl-bankruptcy-v9','bfl-bankruptcy-v10','bfl-bankruptcy-v11']) AS revisions(version)
WHERE previous."version" = 'bfl-bankruptcy-v8';

WITH revisions(version, previous, checksum) AS (
VALUES
  ('bfl-inventory-v2', 'bfl-inventory-v1', '9d806a1764ffdd559a55379b527c340c195d01a62d89a84e0e0b3e7079644fcc'),
  ('bfl-statement-v9', 'bfl-statement-v8', '8c9b0ec1c1173b78dbe08ba7381055d9280591e0471c58d7e10920ab634171f0'),
  ('bfl-statement-v10', 'bfl-statement-v8', 'c11601b96f11a773cb766b06df0f1a0086eefe075df08fce65629b0fa46e314e'),
  ('bfl-creditors-v3', 'bfl-creditors-v2', '6d1f640e99e08b500ec4cc6273cc26aa399871f4c56d2cca8be570dd1bf516c6')
)
INSERT INTO "DocumentTemplateVersion" ("version", "templateId", "title", "checksum")
SELECT next.version, previous."templateId", previous."title", next.checksum
FROM revisions next
JOIN "DocumentTemplateVersion" previous ON previous."version" = next.previous;

INSERT INTO "PackageDocument" VALUES
  ('bfl-bankruptcy-v9', 'bfl-statement-v9', 0),
  ('bfl-bankruptcy-v9', 'bfl-inventory-v1', 1),
  ('bfl-bankruptcy-v9', 'bfl-creditors-v2', 2),
  ('bfl-bankruptcy-v10', 'bfl-statement-v10', 0),
  ('bfl-bankruptcy-v10', 'bfl-inventory-v1', 1),
  ('bfl-bankruptcy-v10', 'bfl-creditors-v2', 2),
  ('bfl-bankruptcy-v11', 'bfl-statement-v10', 0),
  ('bfl-bankruptcy-v11', 'bfl-inventory-v2', 1),
  ('bfl-bankruptcy-v11', 'bfl-creditors-v3', 2);

WITH bindings(version, previous, tags) AS (
VALUES
  ('bfl-inventory-v2', 'bfl-inventory-v1', ARRAY[
    'aircraft', 'aircraft.address', 'aircraft.amount', 'aircraft.description',
    'aircraft.identifier', 'aircraft.ownership', 'aircraft.pledge', 'apartment', 'apartments',
    'apartments.address', 'apartments.area', 'apartments.basis', 'apartments.description',
    'apartments.ownership', 'apartments.pledge', 'art', 'art.address', 'art.amount',
    'art.description', 'art.pledge', 'bankAccounts', 'bankAccounts.amount', 'bankAccounts.name',
    'bankAccounts.openedAt', 'bankAccounts.type', 'birthDate', 'birthPlace', 'boats',
    'boats.address', 'boats.amount', 'boats.description', 'boats.identifier', 'boats.ownership',
    'boats.pledge', 'building', 'cars', 'cars.address', 'cars.amount', 'cars.description',
    'cars.identifier', 'cars.ownership', 'cars.pledge', 'cash', 'cash.address', 'cash.amount',
    'cash.pledge', 'city', 'companyEquity', 'companyEquity.address', 'companyEquity.amount',
    'companyEquity.basis', 'companyEquity.name', 'companyEquity.share', 'district', 'documentDate',
    'documentNumber', 'farmVehicles', 'farmVehicles.address', 'farmVehicles.amount',
    'farmVehicles.description', 'farmVehicles.identifier', 'farmVehicles.ownership',
    'farmVehicles.pledge', 'firstName', 'garages', 'garages.address', 'garages.area',
    'garages.basis', 'garages.description', 'garages.ownership', 'garages.pledge', 'house',
    'houses', 'houses.address', 'houses.area', 'houses.basis', 'houses.description',
    'houses.ownership', 'houses.pledge', 'inn', 'jewellery', 'jewellery.address',
    'jewellery.amount', 'jewellery.description', 'jewellery.pledge', 'land', 'land.address',
    'land.area', 'land.basis', 'land.description', 'land.ownership', 'land.pledge', 'lastName',
    'locality', 'middleName', 'motorcycles', 'motorcycles.address', 'motorcycles.amount',
    'motorcycles.description', 'motorcycles.identifier', 'motorcycles.ownership',
    'motorcycles.pledge', 'otherRealEstate', 'otherRealEstate.address', 'otherRealEstate.area',
    'otherRealEstate.basis', 'otherRealEstate.description', 'otherRealEstate.ownership',
    'otherRealEstate.pledge', 'otherSecurities', 'otherSecurities.amount', 'otherSecurities.name',
    'otherSecurities.nominal', 'otherSecurities.quantity', 'otherSecurities.type', 'otherValuables',
    'otherValuables.address', 'otherValuables.amount', 'otherValuables.description',
    'otherValuables.pledge', 'otherVehicles', 'otherVehicles.address', 'otherVehicles.amount',
    'otherVehicles.description', 'otherVehicles.identifier', 'otherVehicles.ownership',
    'otherVehicles.pledge', 'previousNames', 'professional', 'professional.address',
    'professional.amount', 'professional.description', 'professional.pledge', 'region', 'snils',
    'street', 'trucks', 'trucks.address', 'trucks.amount', 'trucks.description',
    'trucks.identifier', 'trucks.ownership', 'trucks.pledge'
  ]),
  ('bfl-statement-v9', 'bfl-statement-v8', ARRAY[
    'attachments', 'attachments.description', 'birthDate', 'birthPlace', 'businessDebts',
    'businessDebts.amount', 'businessDebts.basis', 'businessDebts.name', 'businessDebts.proof',
    'businessDebts.type', 'companyParticipationDetails', 'courtAddress', 'courtName',
    'creditorHeaders', 'creditorHeaders.address', 'creditorHeaders.inn', 'creditorHeaders.name',
    'creditorHeaders.ogrn', 'criminalCasesDetails', 'debtTotal', 'debtTotalWords', 'debtorAddress',
    'debtorCitizenship', 'debtorRegistration', 'debts', 'debts.amount', 'debts.basis', 'debts.name',
    'debts.proof', 'debts.type', 'documentDate', 'documentNumber', 'employmentDetails',
    'familyDetails', 'firstName', 'inn', 'insolvencyDetails', 'lastName', 'liabilityDetails',
    'majorTransactionsDetails', 'middleName', 'passportDepartment', 'passportIssuedAt',
    'passportIssuer', 'propertyDetails', 'requestCitizenship', 'requestDebtorName',
    'requestFullRegistration', 'requestInsolvency', 'signerName', 'snils', 'sroAddress',
    'sroContacts', 'sroName', 'sroPostalAddress', 'statementAttachmentReferences',
    'statementBalanceConclusion', 'statementGroundsText'
  ]),
  ('bfl-statement-v10', 'bfl-statement-v8', ARRAY[
    'attachments', 'attachments.description', 'birthDate', 'birthPlace',
    'companyParticipationDetails', 'courtAddress', 'courtName', 'creditorHeaders',
    'creditorHeaders.address', 'creditorHeaders.inn', 'creditorHeaders.name',
    'creditorHeaders.ogrn', 'criminalCasesDetails', 'debtTotal', 'debtTotalWords', 'debtorAddress',
    'debtorCitizenship', 'debtorRegistration', 'documentDate', 'documentNumber',
    'employmentDetails', 'familyDetails', 'firstName', 'inn', 'insolvencyDetails', 'lastName',
    'liabilityDetails', 'majorTransactionsDetails', 'middleName', 'passportDepartment',
    'passportIssuedAt', 'passportIssuer', 'propertyDetails', 'requestCitizenship',
    'requestDebtorName', 'requestFullRegistration', 'requestInsolvency', 'signerName', 'snils',
    'sroAddress', 'sroContacts', 'sroName', 'sroPostalAddress', 'statementAttachmentReferences',
    'statementBalanceConclusion', 'statementDebts', 'statementDebts.description',
    'statementGroundsText'
  ]),
  ('bfl-creditors-v3', 'bfl-creditors-v2', ARRAY[
    'apartment', 'birthDate', 'birthPlace', 'building', 'businessDebts', 'businessDebts.address',
    'businessDebts.amount', 'businessDebts.arrears', 'businessDebts.basis', 'businessDebts.name',
    'businessDebts.penalties', 'businessDebts.rowNumber', 'businessDebts.type', 'businessPayments',
    'businessPayments.amount', 'businessPayments.name', 'businessPayments.penalties',
    'businessPayments.rowNumber', 'businessReceivables', 'businessReceivables.address',
    'businessReceivables.amount', 'businessReceivables.arrears', 'businessReceivables.basis',
    'businessReceivables.name', 'businessReceivables.penalties', 'businessReceivables.rowNumber',
    'businessReceivables.type', 'businessRefunds', 'businessRefunds.amount', 'businessRefunds.name',
    'businessRefunds.penalties', 'businessRefunds.rowNumber', 'city', 'debtTotal', 'debts',
    'debts.address', 'debts.amount', 'debts.arrears', 'debts.basis', 'debts.name',
    'debts.penalties', 'debts.rowNumber', 'debts.type', 'district', 'documentDate',
    'documentNumber', 'firstName', 'house', 'inn', 'lastName', 'locality', 'mandatoryPayments',
    'mandatoryPayments.amount', 'mandatoryPayments.name', 'mandatoryPayments.penalties',
    'mandatoryPayments.rowNumber', 'middleName', 'previousNames', 'receivables',
    'receivables.address', 'receivables.amount', 'receivables.arrears', 'receivables.basis',
    'receivables.name', 'receivables.penalties', 'receivables.rowNumber', 'receivables.type',
    'refunds', 'refunds.amount', 'refunds.name', 'refunds.penalties', 'refunds.rowNumber', 'region',
    'snils', 'street'
  ])
)
INSERT INTO "DocumentTemplatePlaceholder" ("templateVersion", "tag", "field", "placeholder")
SELECT bindings.version, names.tag, COALESCE(previous."field", names.tag), CASE WHEN names.tag IN ('birthDate', 'passportIssuedAt', 'documentDate')
     THEN 'DD.MM.YYYY г.' ELSE COALESCE(previous."placeholder", 'identity') END
FROM bindings
CROSS JOIN unnest(bindings.tags) AS names(tag)
LEFT JOIN "DocumentTemplatePlaceholder" previous
  ON previous."templateVersion" = bindings.previous AND previous."tag" = names.tag;

WITH revisions(version, previous) AS (
  VALUES
    ('bfl-statement-v9', 'bfl-statement-v8'),
    ('bfl-statement-v10', 'bfl-statement-v8'),
    ('bfl-creditors-v3', 'bfl-creditors-v2')
)
INSERT INTO "DocumentTemplateRequirement" ("templateVersion", "key", "documentKind", "label", "applicability", "position")
SELECT revisions.version, previous."key", previous."documentKind", previous."label", previous."applicability", previous."position"
FROM revisions
JOIN "DocumentTemplateRequirement" previous ON previous."templateVersion" = revisions.previous;

COMMIT;
