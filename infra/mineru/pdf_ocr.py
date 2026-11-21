"""Local Russian OCR and coverage checks for PDF pages and raster images."""
from contextlib import closing
from functools import lru_cache, wraps
import hashlib
from importlib import import_module
from inspect import Parameter, signature
import json
from pathlib import Path
import re
from string import ascii_letters
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
LATIN_LOOKALIKES = str.maketrans('АВЕКМНОРСТХаеорсху', 'ABEKMHOPCTXaeopcxy')
LATIN_ANCHORS = set(ascii_letters) - {chr(char) for char in LATIN_LOOKALIKES.values()}
OCR_TOKEN = re.compile(r'\w+(?:[-‐‑]\w+)*')


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
    if sdk_version != '4.1.7':
        raise RuntimeError(f'Cyrillic OCR requires MinerU 4.1.7, found {sdk_version}')
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
    if hybrid.resolve_small_model_backend() != 'onnx':
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

    engine = import_module('mineru.model.ocr.pp_ocr_v6_onnx')
    recognizer = getattr(engine, 'TextRecognizerONNX', None)
    require_signature(recognizer, '_decode', ('self', positional), ('idx', positional), ('prob', positional))
    if previous[0] == MINERU_REC_PATH:
        decode = recognizer._decode

        @wraps(decode)
        def decode_ocr_text(self, idx, prob):
            text, confidence = decode(self, idx, prob)
            return normalize_ocr_text(text), confidence

        # Normalize at the raster recognizer, before its text is mixed with
        # the native text layer or rendered as Markdown/table markup.
        recognizer._decode = decode_ocr_text

    # The same registry entry is used by atom_model_init and by ONNX calibration.
    # Mutate the process-local registry before any SDK model is initialized.
    repo.paths['ocr_rec'] = OCR_MODEL_PATH
    hybrid.PPOCRV6_DICT_PATH = dictionary
    return model


def normalize_ocr_text(text):
    def restore_latin(match):
        token = match[0]
        if LATIN_ANCHORS.isdisjoint(token):
            return token
        for char in token:
            if unicodedata.name(char, '').startswith('CYRILLIC') and ord(char) not in LATIN_LOOKALIKES:
                return token
        return token.translate(LATIN_LOOKALIKES)

    return OCR_TOKEN.sub(restore_latin, text)


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


def numeric_lookalikes(text):
    return re.sub(r'(?<!\w)(?=[0-9оОoO-]*[0-9])[0-9оОoO-]+(?!\w)',
                  lambda token: token[0].translate(str.maketrans('оОoO', '0000')), text)


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


def read_lines(page, path, scanned=False, covered_blocks=()):
    import numpy as np
    from PIL import ImageEnhance

    def bgr(rgb):
        return np.ascontiguousarray(np.asarray(rgb)[:, :, ::-1])

    width, height = page.get_size()
    scale = min(200 / 72, 2600 / max(width, height))
    with closing(page.render(scale=scale)) as bitmap:
        image = bitmap.to_pil().convert('RGB')
    pixels = bgr(image)
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
    if scanned and any(numeric_lookalikes(line['text']) != line['text'] for line in lines):
        sharper = read_image_lines(bgr(ImageEnhance.Sharpness(image).enhance(3)), path)
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
        value = normalize_ocr_text(''.join(alphabet[index] for index in ids[selected]).strip())
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


def same_region(line, bbox):
    return overlaps_block(line['bbox'], bbox) and overlaps_block(bbox, line['bbox'])


def plain_text_block(block):
    return (block.type in ('text', 'ref_text', 'doc_title', 'paragraph_title')
            and all(span.type == 'text' for span in block.content))


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


def save_pdf(path, middle_json, writer, model):
    import pypdfium2 as pdfium
    from docvortex.export import materialize_middle, validate_materialized_assets
    from docvortex.render.markdown import render_markdown

    middle, assets = materialize_middle(middle_json)
    validate_materialized_assets(middle, assets)
    recovered = []
    confirmed = []
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
                primary = []
                plain = markdown_text(markdown)
                if scanned and re.search(r'[^\W\d_]', plain) and numeric_lookalikes(plain) == plain:
                    for block in parsed_page.blocks:
                        if block.bbox and plain_text_block(block):
                            text = ' '.join(span.content for span in block.content).strip()
                            if len(text) <= 2000 and re.search(r'[^\W\d_]{2,}', text):
                                primary.append((block.bbox, text))
                lines, matched = read_lines(page, model, scanned, [bbox for bbox, _ in primary])
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
                    rows, markdown = recover_page_with_layout(page, lines, layout, scanned)
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
