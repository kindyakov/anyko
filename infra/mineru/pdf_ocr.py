"""Local Russian OCR and coverage checks for PDF pages and raster images."""
from contextlib import closing
from functools import lru_cache
import hashlib
import json
from pathlib import Path
import re
import unicodedata


MODEL_NAME = 'eslav_PP-OCRv5_rec_mobile.onnx'
MODEL_SHA256 = '08705d6721849b1347d26187f15a5e362c431963a2a62bfff4feac578c489aab'
MIN_SCORE = 0.82
RECOVERY_SCORE = 0.88
# A dot followed by a space can terminate a sentence after a number.
NUMBER = re.compile(r'(?:[+\-−]\s*)?(?:(?<!\d)[.,]\s*)?\d+(?:(?:\.|\s+\.\s*|\s*[,:/\-−]\s*)\d+)*')


def model_path(home):
    return Path(home) / 'models' / 'anyko' / MODEL_NAME


def valid_model(path):
    if not path.is_file():
        return False
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest() == MODEL_SHA256


def normalized(text):
    return ''.join(char for char in unicodedata.normalize('NFKC', text).casefold() if char.isalnum())


def comparable_text(text):
    return ' '.join(unicodedata.normalize('NFKC', text).casefold().split())


def number_notation(text):
    return NUMBER.findall(text)


def numeric_fragment(text):
    # A detached sign or separator is still meaningful and may not disappear.
    return not NUMBER.sub('', text).strip(' .\t\n')


def needs_recovery(markdown, lines):
    plain = normalized(re.sub(r'!\[[^\]]*\]\([^)]+\)|<[^>]+>', '', markdown))
    # Count characters from complete, confident lines. A handful of OCR
    # differences on a good native page should not replace its layout.
    tokens = [normalized(line['text']) for line in lines if line['confidence'] >= RECOVERY_SCORE]
    tokens = [token for token in tokens if len(token) >= 4]
    missing = sum(len(token) for token in tokens if token not in plain)
    return bool(tokens) and (not plain or missing >= max(16, 0.25 * sum(map(len, tokens))))


def reading_rows(lines):
    rows = []
    for line in sorted(lines, key=lambda item: (item['bbox'][1] + item['bbox'][3]) / 2):
        left, top, right, bottom = line['bbox']
        if rows:
            _, row_top, _, row_bottom = rows[-1][0]['bbox']
            if min(bottom, row_bottom) - max(top, row_top) > min(bottom - top, row_bottom - row_top) / 2:
                rows[-1].append(line)
                continue
        rows.append([line])
    return [sorted(row, key=lambda item: item['bbox'][0]) for row in rows]


@lru_cache(maxsize=1)
def reader(path):
    import onnxruntime as ort
    from mineru.model.ocr.pp_ocr_v6_onnx import TextDetectorONNX
    from mineru.model.registry import small_model_repo

    if not valid_model(path):
        raise ValueError('PDF_OCR_MODEL_MISSING_OR_INVALID')
    config = ort.SessionOptions()
    config.intra_op_num_threads = 3
    session = ort.InferenceSession(str(path), sess_options=config, providers=['CPUExecutionProvider'])
    alphabet = [''] + session.get_modelmeta().custom_metadata_map['character'].splitlines() + [' ']
    if len(alphabet) != session.get_outputs()[0].shape[-1]:
        raise ValueError('PDF_OCR_MODEL_ALPHABET_MISMATCH')
    detector = TextDetectorONNX(
        str(small_model_repo('onnx').ocr_det.ensure()),
        device='cpu', limit_side_len=1800, intra_op_num_threads=3,
    )
    return detector, session, alphabet


def numeric_lookalikes(text):
    return re.sub(r'(?<!\w)(?=[0-9оОoO-]*[0-9])[0-9оОoO-]+(?!\w)',
                  lambda token: token[0].translate(str.maketrans('оОoO', '0000')), text)


def read_lines(page, path, scanned=False):
    import numpy as np
    from PIL import ImageEnhance

    def recognize(image):
        return read_image_lines(np.ascontiguousarray(np.asarray(image)[:, :, ::-1]), path)

    width, height = page.get_size()
    scale = min(200 / 72, 2600 / max(width, height))
    with closing(page.render(scale=scale)) as bitmap:
        image = bitmap.to_pil().convert('RGB')
    lines = recognize(image)
    if scanned and any(numeric_lookalikes(line['text']) != line['text'] for line in lines):
        sharper = recognize(ImageEnhance.Sharpness(image).enhance(3))
        for index, line in enumerate(lines):
            target = numeric_lookalikes(line['text'])
            if target == line['text']:
                continue
            # The alternate image must actually yield the numeric reading, with
            # the same surrounding text at the same position on the page.
            readings = [item for item in sharper if item['text'] == target
                        and item['confidence'] >= RECOVERY_SCORE and same_region(line, item['bbox'])]
            if len(readings) == 1:
                lines[index] = readings[0]
    return lines


def read_image_lines(image, path):
    import numpy as np
    from mineru.model.ocr.image import get_rotate_crop_image_for_text_rec, resize_text_recognition_image

    detector, session, alphabet = reader(path)
    height, width = image.shape[:2]
    boxes, _ = detector(image)
    if boxes is None:
        return []
    lines = []
    for box in boxes:
        crop = get_rotate_crop_image_for_text_rec(image, np.asarray(box, dtype=np.float32))
        if crop is None:
            continue
        tensor = resize_text_recognition_image(crop, crop.shape[1] / crop.shape[0], (3, 48, 320))
        probabilities = session.run(None, {session.get_inputs()[0].name: tensor[None, ...]})[0][0]
        ids = probabilities.argmax(-1)
        selected = np.r_[True, ids[1:] != ids[:-1]] & (ids != 0)
        if not selected.any():
            continue
        value = ''.join(alphabet[index] for index in ids[selected]).strip()
        if not value or len(value) > 2000:
            continue
        minimum = np.min(box, axis=0)
        maximum = np.max(box, axis=0)
        bbox = [round(max(0, min(1, float(coordinate))), 5) for coordinate in (
            minimum[0] / width, minimum[1] / height, maximum[0] / width, maximum[1] / height,
        )]
        if bbox[0] >= bbox[2] or bbox[1] >= bbox[3]:
            continue
        lines.append({
            'text': value, 'bbox': bbox,
            'confidence': round(float(probabilities.max(-1)[selected].mean()), 4),
        })
    return lines


def recover_page(page, lines):
    width, height = page.get_size()
    accepted = []
    with closing(page.get_textpage()) as text_page:
        for line in lines:
            left, top, right, bottom = line['bbox']
            native = text_page.get_text_bounded(left * width, (1 - bottom) * height,
                                                right * width, (1 - top) * height)
            native = ' '.join(native.split())
            agreement = normalized(native) == normalized(line['text'])
            ocr_digits = re.sub(r'\D', '', line['text'])
            native_digits = re.sub(r'\D', '', native)
            verified_number = (
                len(native_digits) >= 4 and native_digits == ocr_digits
                and re.fullmatch(r'[0-9\s‐‑-]+', native) is not None
            )
            if len(native_digits) >= max(4, len(ocr_digits) - 1) and native_digits not in ocr_digits:
                # Two plausible readings of a number are insufficient for automatic filling.
                continue
            if (not agreement and not verified_number and native_digits and native_digits == ocr_digits
                    and number_notation(native) != number_notation(line['text'])):
                # Matching digits with a different decimal separator or sign can change the value.
                continue
            if (line['confidence'] >= MIN_SCORE or agreement or verified_number) and normalized(line['text']):
                accepted.append({**line, 'text': native if agreement or verified_number else line['text']})
    return reading_rows(accepted)


def markdown_row(row):
    return '　'.join(re.sub(r'([\\`*_{}\[\]()#+.!|<>~$]|(?<!\w)-|-(?!\w))', r'\\\1', line['text']) for line in row)


def recover_image_markdown(original, frames):
    """Replace incomplete text only when confident Cyrillic lines are missing."""
    accepted = [
        [line for line in lines if line['confidence'] >= MIN_SCORE and normalized(line['text'])]
        for lines in frames
    ]
    if any(not lines for lines in accepted) and normalized(original):
        return None
    cyrillic = [
        line for lines in accepted for line in lines
        if len(re.findall(r'[А-Яа-яЁё]', line['text'])) >= 4
    ]
    if not needs_recovery(original, cyrillic):
        return None
    return '\n\n'.join(
        (f'## Страница {number}\n\n' if len(accepted) > 1 else '')
        + '\n\n'.join(map(markdown_row, reading_rows(lines)))
        for number, lines in enumerate(accepted, start=1)
    )


def overlaps_block(line, bbox):
    left, top, right, bottom = line['bbox']
    block_left, block_top, block_right, block_bottom = bbox
    width = min(right, block_right) - max(left, block_left)
    height = min(bottom, block_bottom) - max(top, block_top)
    return width > (right - left) / 2 and height > (bottom - top) / 2


def same_region(line, bbox):
    return overlaps_block(line, bbox) and overlaps_block({'bbox': bbox}, line['bbox'])


def restores_scan_fragment(original, replacement):
    # Basic may return isolated symbols for Cyrillic or drop leading zeros.
    # Accept additions only in a confident, co-located Cyrillic line.
    if not re.search(r'[а-яё]{3,}', replacement) or re.search(r'[^\W\d_]{3,}|[а-яё]', original):
        return False
    previous = number_notation(original)
    current = number_notation(replacement)
    if not previous:
        return not current and len(normalized(original)) * 2 < len(normalized(replacement))
    if not numeric_fragment(original) or len(previous) != len(current):
        return False
    for old, new in zip(previous, current):
        # Preserve the significant digits and separators, including decimal
        # places. Only leading zeros in each hyphen-delimited group may grow.
        pattern = re.sub(r'(^|(?<=-))0+', lambda run: f'0{{{len(run[0])},}}', re.escape(old))
        if not re.fullmatch(pattern, new):
            return False
    return True


def recover_page_with_layout(page, lines, layout, scanned=False):
    prose = [line for row in recover_page(page, lines) for line in row]
    matched = []
    blocks = []
    for bbox, top, markdown, plain_text in layout:
        nearby = [line for line in prose if bbox and overlaps_block(line, bbox)]
        original = comparable_text(markdown)
        replacement = comparable_text(' '.join(line['text'] for line in nearby))
        # Replace a text block only when accepted OCR covers all of it and adds
        # content. Keep the punctuation and word boundaries, including in numbers.
        if plain_text and replacement:
            numeric_only = numeric_fragment(original)
            same_numbers = number_notation(original) == number_notation(replacement)
            covers_text = (
                len(replacement) > len(original) and f' {original} ' in f' {replacement} '
                and (not numeric_only or same_numbers)
            )
            restores_words = (
                numeric_only and same_numbers and any(char.isalpha() for char in replacement)
            )
            restores_fragment = (
                scanned and len(nearby) == 1 and nearby[0]['confidence'] >= RECOVERY_SCORE
                and same_region(nearby[0], bbox) and restores_scan_fragment(original, replacement)
            )
            if covers_text or restores_words or restores_fragment:
                continue
        blocks.append((top, markdown))
        for line in nearby:
            prose.remove(line)
            # OCR may locate matching native prose without duplicating it.
            if plain_text and f" {comparable_text(line['text'])} " in f' {original} ':
                matched.append(line)
    blocks.extend((row[0]['bbox'][1], markdown_row(row)) for row in reading_rows(prose))
    markdown = '\n\n'.join(content for _, content in sorted(blocks, key=lambda block: block[0]))
    return reading_rows(prose + matched), markdown


def save_pdf(path, middle_json, writer, model):
    import pypdfium2 as pdfium
    from docvortex.export import materialize_middle, validate_materialized_assets
    from docvortex.render.markdown import render_markdown

    middle, assets = materialize_middle(middle_json)
    validate_materialized_assets(middle, assets)
    recovered = []
    sections = []
    readable = False
    with pdfium.PdfDocument(path) as pdf:
        if len(pdf) != len(middle.pages):
            raise ValueError('PDF_OCR_PAGE_COUNT_MISMATCH')
        for number, parsed_page in enumerate(middle.pages, start=1):
            single_page = middle.model_copy(update={'pages': [parsed_page]})
            markdown = render_markdown(single_page)
            with closing(pdf[number - 1]) as page:
                with closing(page.get_textpage()) as native:
                    scanned = native.count_chars() == 0
                lines = read_lines(page, model, scanned)
                if needs_recovery(markdown, lines):
                    layout = []
                    top = 0
                    for block in parsed_page.blocks:
                        if block.bbox:
                            top = block.bbox[1]
                        plain_text = (
                            block.type in ('text', 'ref_text', 'doc_title', 'paragraph_title')
                            and all(span.type == 'text' for span in block.content)
                        )
                        block_page = parsed_page.model_copy(update={'blocks': [block]})
                        block_markdown = render_markdown(single_page.model_copy(update={'pages': [block_page]}))
                        if block_markdown:
                            layout.append((block.bbox, top, block_markdown, plain_text))
                    rows, markdown = recover_page_with_layout(page, lines, layout, scanned)
                    recovered.append({
                        'page': number, 'omittedLines': len(lines) - sum(map(len, rows)),
                        'lines': [line for row in rows for line in row],
                    })
            readable |= bool(normalized(re.sub(r'!\[[^\]]*\]\([^)]+\)|<[^>]+>', '', markdown)))
            if len(pdf) > 1 or recovered and recovered[-1]['page'] == number:
                markdown = f'## Страница {number}\n\n{markdown}'
            sections.append(markdown)
    if not readable and not assets:
        raise ValueError('PDF_OCR_NO_READABLE_TEXT')
    # The whole-document renderer joins tables marked as continuations. Keep the
    # physical page boundary so similar tables on adjacent pages stay independent.
    writer.write_string('markdown.md', '\n\n'.join(sections))
    writer.write_string('pdf-ocr.json', json.dumps({'version': 1, 'pages': recovered}, ensure_ascii=False))
    for name, payload in sorted(assets.items()):
        writer.write(name, payload)
