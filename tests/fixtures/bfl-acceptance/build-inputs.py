from pathlib import Path
from tempfile import TemporaryDirectory
from time import gmtime
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo
import os
from PIL import Image, ImageDraw, ImageFont
from docx import Document

root = Path(__file__).resolve().parent
out = root / 'active'
out.mkdir(exist_ok=True)
font_dir = Path(os.environ.get('ANYKO_BFL_FIXTURE_FONTS', 'C:/Windows/Fonts'))
person='Примеров Матвей Лабораториевич'
address='Липецкая область, г. Задонск, ул. Контрольная, д. 01, кв. 000'
def docx(file, title, paragraphs):
    doc=Document()
    doc.add_heading(title,0)
    for line in paragraphs:
        doc.add_paragraph(line)
    doc.save(out/file)
def card(filename, title, lines):
    image=Image.new('RGB',(1500,960),'#f8f3ec')
    draw=ImageDraw.Draw(image)
    draw.rectangle((45,45,1455,915),outline='#8d7d74',width=2)
    title_font=ImageFont.truetype(str(font_dir/'timesbd.ttf'),44)
    body_font=ImageFont.truetype(str(font_dir/'times.ttf'),37)
    draw.text((100,80),title,font=title_font,fill='#211b18')
    for index,line in enumerate(lines):
        draw.text((100,170+70*index),line,font=body_font,fill='#302825')
    if filename.endswith('.pdf'):
        image.save(out/filename, creationDate=gmtime(0), modDate=gmtime(0))
    else:
        image.save(out/filename)
card('01-passport.png','РОССИЙСКАЯ ФЕДЕРАЦИЯ',[
    'Паспорт гражданина Российской Федерации',
    'Паспорт выдан УМВД РОССИИ ПО ЛИПЕЦКОЙ ОБЛАСТИ',
    'Дата выдачи 19.08.2022    Код подразделения 000-000',
    'Серия и номер 00 00 000000',
    'Фамилия ПРИМЕРОВ',
    'Имя МАТВЕЙ',
    'Отчество ЛАБОРАТОРИЕВИЧ',
    'Дата рождения 27.02.1986',
    'Место рождения ГОР. ЛИПЕЦК',
])
docx('02-registration.docx','Сведения о регистрации по месту жительства',[person,'Адрес регистрации: '+address])
card('03-snils.pdf','Форма АДИ-РЕГ',[
    'Документ о регистрации в системе индивидуального учёта',
    person,'Страховой номер индивидуального лицевого счёта 000-000-001 00',
])
docx('04-bank-vtb-current.docx','Справка о размере задолженности',[
    'Банк ВТБ (ПАО). ИНН 7702070139, ОГРН 1027739609391.',
    'Заёмщик: '+person+'.','Справка № QA-5417 от 18.11.2026. Расчёт по состоянию на 18.11.2026.',
    'Кредитный договор № QA-VT-51 от 23.05.2024.',
    'Полная задолженность по кредитному договору № QA-VT-51 — 145 006,47 руб.',
    'Кредитный договор № QA-VT-52 от 16.06.2024.',
    'Полная задолженность по кредитному договору № QA-VT-52 — 11 500,25 руб.',
    'Кредитный договор № QA-VT-53 от 15.01.2024. Договор закрыт. Задолженность отсутствует.',
])
docx('05-bank-vtb-earlier.docx','Справка о размере задолженности',[
    'Банк ВТБ (ПАО). ИНН 7702070139, ОГРН 1027739609391.',
    'Заёмщик: '+person+'.','Справка № QA-5110 от 28.10.2026. Расчёт по состоянию на 28.10.2026.',
    'Кредитный договор № QA-VT-51 от 23.05.2024.',
    'Полная задолженность по кредитному договору № QA-VT-51 — 151 000,00 руб.',
])
docx('06-bank-t.docx','Справка о размере задолженности',[
    'АО «ТБанк». ИНН 7710140679, ОГРН 1027739642281.',
    'Заёмщик: '+person+'.','Справка № QA-620 от 20.11.2026. Расчёт по состоянию на 20.11.2026.',
    'Договор потребительского кредита № QA-T-62 от 17.07.2025.',
    'Полная задолженность по договору № QA-T-62 — 15 993,53 руб.',
])
docx('07-employment.docx','Сведения о трудовой деятельности',[
    person+'.','04.12.2023 — приём на работу в ООО «Первая мастерская».',
    '28.02.2026 — увольнение из ООО «Первая мастерская».','15.03.2026 — приём на работу в ООО «Вторая мастерская». Трудовой договор действует.',
])
for name, employer, months in [
    ('08-income-old.docx','ООО «Первая мастерская»',[(1,48000),(2,48000)]),
    ('09-income-new.docx','ООО «Вторая мастерская»',[(3,36000),(4,60000),(5,60000),*[(i,42000) for i in range(6,12)]]),
]:
    d=Document()
    d.add_heading('Справка о доходах и суммах налога физического лица',0)
    for line in ('За 2026 год. Дата выдачи: 21.11.2026.','Налоговый агент: '+employer,'Физическое лицо: '+person,'Доходы, облагаемые по ставке 13%'):
        d.add_paragraph(line)
    table=d.add_table(rows=1,cols=3)
    table.style='Table Grid'
    for cell,text in zip(table.rows[0].cells,['Месяц','Код дохода','Сумма дохода, руб.']):
        cell.text=text
    for month,amount in months:
        for cell,text in zip(table.add_row().cells,[str(month),'2000',f'{amount},00']):
            cell.text=text
    d.save(out/name)
docx('10-property.docx','Выписка из Единого государственного реестра недвижимости',[
    'Дата выдачи: 18.11.2026. Правообладатель: '+person+'.',
    'Вид объекта недвижимости: квартира. Кадастровый номер: 48:08:0000000:9000001.',
    'Адрес: Липецкая область, г. Задонск, ул. Макетная, д. 02, корп. 2, кв. 000.',
    'Площадь: 42,8 кв. м. Вид права: общая долевая собственность, доля 1/2.',
])
docx('11-family.docx','Анкета заявителя',[person+' не состоит в зарегистрированном браке. На иждивении один несовершеннолетний ребёнок.'])
docx('12-cash-and-names.docx','Сведения об имуществе и личных данных',[
    person+'.','Наличные денежные средства: 2 300,00 руб.','Фамилия, имя и отчество не менялись.',
])
card('13-inn.pdf','УВЕДОМЛЕНИЕ О ПОСТАНОВКЕ НА УЧЁТ',[
    'Налоговый орган: инспекция по месту жительства',
    'Сведения о постановке на учёт физического лица', person,
    'Идентификационный номер налогоплательщика', 'ИНН 001234567887',
    'Дата постановки на учёт 14.06.2022',
])
docx('14-debtor-questionnaire.docx','Анкета должника для юриста',[
    person+'.', 'Фамилию, имя и отчество не изменял.',
    'Предпринимательской деятельностью не занимался, статуса ИП не имел.',
])
docx('15-tax-status.docx','Справка о состоянии расчётов с бюджетом',[
    'Налогоплательщик: '+person+'.',
    'По состоянию на 21.11.2026 задолженность по обязательным платежам физического лица, пеням и штрафам отсутствует.',
])
docx('16-supplement.docx','Сопроводительная записка',[
    'Синтетическое приложение для повторной генерации. Сведения о должнике не изменились.',
])

out = root / 'dismissed'
out.mkdir(exist_ok=True)
card('01-passport.png','РОССИЙСКАЯ ФЕДЕРАЦИЯ',[
    'Паспорт гражданина Российской Федерации',
    'Паспорт выдан УМВД РОССИИ ПО ЛИПЕЦКОЙ ОБЛАСТИ',
    'Дата выдачи 19.08.2022    Код подразделения 000-000',
    'Серия и номер 00 00 000001',
    'Фамилия МАКЕТОВА',
    'Имя ЕЛЕНА',
    'Отчество ПАВЛОВНА',
    'Дата рождения 11.05.1987',
    'Место рождения ГОР. ЛИПЕЦК',
])
docx('02-registration.docx','Сведения о регистрации по месту жительства',[
    'Макетова Елена Павловна',
    'Адрес регистрации: Липецкая область, г. Липецк, ул. Учебная, д. 03, кв. 002',
])
docx('07-employment.docx','Сведения о трудовой деятельности',[
    'Макетова Елена Павловна.',
    '04.12.2023 — приём на работу в ООО «Первая мастерская».',
    '28.02.2026 — увольнение из ООО «Первая мастерская».',
])
docx('11-family.docx','Анкета заявителя',[
    'Макетова Елена Павловна не состоит в зарегистрированном браке. Детей на иждивении нет.',
])

with TemporaryDirectory(dir=root) as scratch:
    for path in sorted(root.glob('*/*.docx')):
        if path.parent.name not in ('active', 'dismissed'):
            continue
        cleaned = Path(scratch) / path.name
        with ZipFile(path) as original, ZipFile(cleaned, 'w', ZIP_DEFLATED) as archive:
            for member in original.namelist():
                record = ZipInfo(member, date_time=(2026, 11, 21, 0, 0, 0))
                record.compress_type = ZIP_DEFLATED
                archive.writestr(record, original.read(member))
        path.write_bytes(cleaned.read_bytes())


