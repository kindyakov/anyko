"""Local Russian OCR and coverage checks for PDF pages and raster images."""
from contextlib import closing
from functools import lru_cache
import hashlib
from importlib import import_module
from inspect import Parameter, signature
import json
import logging
from pathlib import Path
import re
import unicodedata


MODEL_NAME = 'cyrillic_PP-OCRv5_rec_mobile.onnx'
MODEL_SHA256 = '90f761b4bfcce0c8c561c0cb5c887b0971d3ec01c32164bdf7374a35b0982711'
DICTIONARY_SHA256 = 'db40aa52ceb112055be80c694afdf655d5d2c4f7873704524cc16a447ca913ba'
MINERU_MODEL_REPO = 'MinerU-4_models_onnx'
MINERU_REC_PATH = 'OCR/paddleocr/ch_PP-OCRv6_small_rec_infer.onnx'
OCR_MODEL_PATH = f'OCR/paddleocr/{MODEL_NAME}'
MIN_SCORE = 0.82
RECOVERY_SCORE = 0.88
# A dot followed by a space can terminate a sentence after a number.
NUMBER = re.compile(r'(?:[+\-−]\s*)?(?:(?<!\d)[.,]\s*)?\d+(?:(?:\.|\s+\.\s*|\s*[,:/\-−]\s*)\d+)*')
logger = logging.getLogger('uvicorn.error')


def model_path(home):
    return Path(home) / 'models' / MINERU_MODEL_REPO / OCR_MODEL_PATH


def matches_sha256(path, expected):
    if not path.is_file():
        return False
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest() == expected


def valid_model(path):
    return matches_sha256(path, MODEL_SHA256)


def require_signature(module, name, *parameters):
    function = getattr(module, name, None)
    if not callable(function) or tuple(
        (parameter.name, parameter.kind) for parameter in signature(function).parameters.values()
    ) != parameters:
        raise RuntimeError(f'Incompatible MinerU OCR binding: {name}')


def configure_primary_ocr(sdk_version):
    if sdk_version != '4.2.3':
        raise RuntimeError(f'Cyrillic OCR requires MinerU 4.2.3, found {sdk_version}')
    hybrid = import_module('mineru.model.runtime.hybrid')
    positional = Parameter.POSITIONAL_OR_KEYWORD
    require_signature(hybrid, 'atom_model_init', ('model_name', positional), ('kwargs', Parameter.VAR_KEYWORD))
    onnx_device = import_module('mineru.model.runtime.onnx_device')
    require_signature(onnx_device, '_select', ('requested', positional), ('intra_op_num_threads', positional),
                      ('inter_op_num_threads', positional), ('allow_download', Parameter.KEYWORD_ONLY))
    registry = import_module('mineru.model.registry')
    resources = import_module('mineru.model.ocr.resources')
    repo = getattr(registry, 'MINERU_4_MODELS_ONNX', None)
    if (repo is None or getattr(hybrid, 'MINERU_4_MODELS_ONNX', None) is not repo
            or getattr(repo, 'local_name', None) != MINERU_MODEL_REPO
            or not isinstance(getattr(repo, 'paths', None), dict)):
        raise RuntimeError('Incompatible MinerU OCR binding: MINERU_4_MODELS_ONNX')
    require_signature(repo, 'local_dir')
    device = import_module('mineru.model.runtime.device_state')
    if device.resolve_model_backend() != 'onnx':
        raise RuntimeError('Cyrillic OCR requires the ONNX small-model backend')
    model = repo.local_dir() / OCR_MODEL_PATH
    dictionary = model.with_suffix('.txt')
    stock_dictionary = getattr(resources, 'PPOCRV6_DICT_PATH', None)
    previous = (repo.paths.get('ocr_rec'), getattr(hybrid, 'PPOCRV6_DICT_PATH', None))
    if not isinstance(stock_dictionary, Path) or previous not in (
        (MINERU_REC_PATH, stock_dictionary), (OCR_MODEL_PATH, dictionary),
    ):
        raise RuntimeError('Incompatible MinerU OCR binding: ocr_rec / PPOCRV6_DICT_PATH')
    require_signature(repo.ocr_rec, 'ensure', ('source', Parameter.KEYWORD_ONLY))
    if not valid_model(model) or not matches_sha256(dictionary, DICTIONARY_SHA256):
        raise RuntimeError('Cyrillic OCR weights or dictionary missing or invalid; run MinerU setup')

    # The same registry entry is used by atom_model_init and by ONNX calibration.
    # Mutate the process-local registry before any SDK model is initialized.
    repo.paths['ocr_rec'] = OCR_MODEL_PATH
    hybrid.PPOCRV6_DICT_PATH = dictionary
    return model


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
    plain = normalized(markdown_text(markdown))
    # Count characters from complete, confident lines. A handful of OCR
    # differences on a good native page should not replace its layout.
    tokens = [normalized(line['text']) for line in lines if line['confidence'] >= RECOVERY_SCORE]
    tokens = [token for token in tokens if len(token) >= 4]
    missing = sum(len(token) for token in tokens if token not in plain)
    return bool(tokens) and (not plain or missing >= max(16, 0.25 * sum(map(len, tokens))))


def markdown_text(markdown):
    return re.sub(r'!\[[^\]]*\]\([^)]+\)|<[^>]+>', '', markdown)


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
def text_detector():
    from mineru.model.ocr.pp_ocr_v6_onnx import TextDetectorONNX
    from mineru.model.registry import small_model_repo

    return TextDetectorONNX(
        str(small_model_repo('onnx').ocr_det.ensure()),
        device='cpu', limit_side_len=1800, intra_op_num_threads=3,
    )


def detect_image_boxes(image):
    boxes, _ = text_detector()(image)
    return boxes if boxes is not None else ()


@lru_cache(maxsize=1)
def reader(path):
    import onnxruntime as ort

    if not valid_model(path):
        raise ValueError('PDF_OCR_MODEL_MISSING_OR_INVALID')
    config = ort.SessionOptions()
    config.intra_op_num_threads = 3
    session = ort.InferenceSession(str(path), sess_options=config, providers=['CPUExecutionProvider'])
    alphabet = [''] + session.get_modelmeta().custom_metadata_map['character'].splitlines() + [' ']
    if len(alphabet) != session.get_outputs()[0].shape[-1]:
        raise ValueError('PDF_OCR_MODEL_ALPHABET_MISMATCH')
    return session, alphabet


def box_coordinates(box, image):
    import numpy as np

    height, width = image.shape[:2]
    left, top = np.min(box, axis=0)
    right, bottom = np.max(box, axis=0)
    return [round(max(0, min(1, float(value))), 5) for value in (
        left / width, top / height, right / width, bottom / height,
    )]


def match_scan_blocks(boxes, pixels, covered_blocks):
    matched = set()
    for box in boxes:
        bbox = box_coordinates(box, pixels)
        candidates = [index for index, block in enumerate(covered_blocks) if overlaps_block(bbox, block)]
        # A coarse block can contain one recognized line and a missing line.
        if len(candidates) != 1 or candidates[0] in matched:
            return None
        matched.add(candidates[0])
    return sorted(matched)


def read_lines(page, path, covered_blocks=()):
    import numpy as np

    width, height = page.get_size()
    scale = min(200 / 72, 2600 / max(width, height))
    with closing(page.render(scale=scale)) as bitmap:
        image = bitmap.to_pil().convert('RGB')
    pixels = np.ascontiguousarray(np.asarray(image)[:, :, ::-1])
    if covered_blocks:
        boxes = detect_image_boxes(pixels)
        # Scans with complete layout coverage need detection only. If text
        # falls outside the SDK layout, recognize the existing crops once.
        matched = match_scan_blocks(boxes, pixels, covered_blocks)
        if matched is not None:
            return [], matched
        lines = read_image_lines(pixels, path, boxes)
    else:
        lines = read_image_lines(pixels, path)
    return lines, []


def read_image_lines(image, path, boxes=None):
    import numpy as np
    from mineru.model.ocr.image import get_rotate_crop_image_for_text_rec, resize_text_recognition_image

    boxes = detect_image_boxes(image) if boxes is None else boxes
    if not len(boxes):
        return []
    session, alphabet = reader(path)
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
        bbox = box_coordinates(box, image)
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


def overlaps_block(line_bbox, bbox):
    left, top, right, bottom = line_bbox
    block_left, block_top, block_right, block_bottom = bbox
    width = min(right, block_right) - max(left, block_left)
    height = min(bottom, block_bottom) - max(top, block_top)
    return width > (right - left) / 2 and height > (bottom - top) / 2


def plain_text_block(block):
    return (block.type in ('text', 'ref_text', 'doc_title', 'paragraph_title')
            and all(span.type == 'text' for span in block.content))


def recover_page_with_layout(page, lines, layout):
    prose = [line for row in recover_page(page, lines) for line in row]
    matched = []
    blocks = []
    for bbox, top, markdown, plain_text in layout:
        nearby = [line for line in prose if bbox and overlaps_block(line['bbox'], bbox)]
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
            if covers_text or restores_words:
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


def export_page_evidence(recovered, confirmed):
    pages = list(recovered)
    size = len(json.dumps({'version': 1, 'pages': pages}, ensure_ascii=False).encode('utf-8'))
    # Preserve recovery evidence first. Optional scan coordinates must fit the
    # existing adapter limit without making a previously readable PDF fail.
    for page in confirmed:
        if len(pages) >= 1000:
            break
        page_size = len(json.dumps(page, ensure_ascii=False).encode('utf-8')) + 2
        if size + page_size <= 2 * 1024 * 1024:
            pages.append(page)
            size += page_size
    return json.dumps({'version': 1, 'pages': sorted(pages, key=lambda page: page['page'])}, ensure_ascii=False)


def continued_table_pages(pages):
    # A continuation can consume the previous page's last table at render time.
    return {
        number
        for page in pages
        if any(block.type == 'table' and block.continues_prev for block in page.blocks)
        for number in (page.page_idx - 1, page.page_idx)
    }


def verify_table_text(body, page, native):
    from lxml import html
    from pypdfium2.raw import FPDF_PAGEOBJ_IMAGE

    if not body.bbox or not body.content.strip().lower().startswith('<table') or page.get_rotation():
        return False
    table = html.fromstring(body.content)
    if table.tag != 'table' or table.xpath('.//table | .//img | .//svg | .//math | .//script | .//style'):
        return False
    cells = [' '.join(cell.text_content().split()) for cell in table.xpath('.//td | .//th')]
    expected = ' '.join(cell for cell in cells if cell)
    if not expected:
        return False
    left, bottom, right, top = page.get_bbox()
    x0, y0, x1, y1 = body.bbox
    if not (0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1):
        return False
    bounds = (
        left + x0 * (right - left), top - y1 * (top - bottom),
        left + x1 * (right - left), top - y0 * (top - bottom),
    )
    bounded = native.get_text_bounded(*bounds, errors='strict')
    # Requiring equality accounts for every occurrence, including repeated cells,
    # and avoids treating text in a larger value as proof for a shorter one.
    if ' '.join(bounded.split()) != expected:
        return False
    # A scan can carry a hidden OCR layer. Only trust standalone native tables.
    x0, y0, x1, y1 = bounds
    for image in page.get_objects(filter=[FPDF_PAGEOBJ_IMAGE]):
        if image.level:
            return False
        left, bottom, right, top = image.get_bounds()
        if left < x1 and x0 < right and bottom < y1 and y0 < top:
            return False
    return True


def record_table_origins(records, single_page, page, markdown, assets, continued, render):
    parsed = single_page.pages[0]
    for block in parsed.blocks:
        if block.type != 'table':
            continue
        bodies = [body for body in block.content if body.type == 'table_body']
        for body in bodies:
            path = body.image_path
            if not path or path not in assets:
                continue
            if path in records:
                records[path]['origin'] = 'unknown'
                continue
            record = {'imagePath': path, 'page': parsed.page_idx + 1, 'origin': 'unknown'}
            records[path] = record
            if continued or len(bodies) != 1:
                continue
            try:
                with closing(page.get_textpage()) as native:
                    if not native.count_chars() or not verify_table_text(body, page, native):
                        continue
                table = block.model_copy(update={'content': [body]})
                fragment_page = parsed.model_copy(update={'blocks': [table]})
                fragment = render(single_page.model_copy(update={'pages': [fragment_page]})).strip()
                content = f'\n\n{markdown.strip()}\n\n'
                needle = f'\n\n{fragment}\n\n'
                first = content.find(needle)
                if fragment.startswith(('<table', '|')) and first >= 0 and content.find(needle, first + 1) < 0:
                    record['origin'] = 'native'
            except Exception as error:
                # Provenance is optional. Keep the crop available without logging document text.
                logger.warning('pdf_table_origin_unverified page=%s error_type=%s',
                               record['page'], type(error).__name__)


def save_pdf(path, middle_json, writer, model):
    import pypdfium2 as pdfium
    from docvortex.export import materialize_middle, validate_materialized_assets
    from docvortex.render.markdown import render_markdown

    middle, assets = materialize_middle(middle_json)
    validate_materialized_assets(middle, assets)
    recovered = []
    confirmed = []
    sections = []
    table_origins = {}
    continued = continued_table_pages(middle.pages)
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
                primary = []
                plain = markdown_text(markdown)
                if scanned and re.search(r'[^\W\d_]', plain):
                    for block in parsed_page.blocks:
                        if block.bbox and plain_text_block(block):
                            text = ' '.join(span.content for span in block.content).strip()
                            if len(text) <= 2000 and re.search(r'[^\W\d_]{2,}', text):
                                primary.append((block.bbox, text))
                lines, matched = read_lines(page, model, [bbox for bbox, _ in primary])
                selected = []
                needs_text = needs_recovery(markdown, lines)
                if needs_text:
                    layout = []
                    top = 0
                    for block in parsed_page.blocks:
                        if block.bbox:
                            top = block.bbox[1]
                        plain_text = plain_text_block(block)
                        block_page = parsed_page.model_copy(update={'blocks': [block]})
                        block_markdown = render_markdown(single_page.model_copy(update={'pages': [block_page]}))
                        if block_markdown:
                            layout.append((block.bbox, top, block_markdown, plain_text))
                    rows, markdown = recover_page_with_layout(page, lines, layout)
                    selected = [line for row in rows for line in row]
                elif matched:
                    selected = [
                        {'text': primary[index][1], 'bbox': primary[index][0], 'source': 'primary-ocr'}
                        for index in matched
                    ]
                elif scanned and lines:
                    # A repeated read may confirm unchanged Markdown. Retain
                    # its original OCR geometry and confidence for citations.
                    text = normalized(plain)
                    selected = [
                        line for row in recover_page(page, lines) for line in row
                        if normalized(line['text']) in text
                    ]
                if selected:
                    limit = len(selected) if needs_text else min(len(selected), 1000)
                    (recovered if needs_text else confirmed).append({
                        'page': number, 'omittedLines': max(len(lines), len(selected)) - limit,
                        'lines': selected[:limit],
                    })
                record_table_origins(
                    table_origins, single_page, page, markdown, assets,
                    parsed_page.page_idx in continued, render_markdown,
                )
            readable |= bool(normalized(markdown_text(markdown)))
            if len(pdf) > 1 or selected:
                markdown = f'## Страница {number}\n\n{markdown}'
            sections.append(markdown)
    if not readable and not assets:
        raise ValueError('PDF_OCR_NO_READABLE_TEXT')
    # The whole-document renderer joins tables marked as continuations. Keep the
    # physical page boundary so similar tables on adjacent pages stay independent.
    writer.write_string('markdown.md', '\n\n'.join(sections))
    writer.write_string('pdf-ocr.json', export_page_evidence(recovered, confirmed))
    for name, payload in sorted(assets.items()):
        writer.write(name, payload)
    if table_origins:
        writer.write_string('pdf-table-images.json', json.dumps(list(table_origins.values())))
