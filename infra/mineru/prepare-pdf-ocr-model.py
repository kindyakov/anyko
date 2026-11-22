"""Install the pinned OCR weights at build/setup time, outside document processing."""
import os
from pathlib import Path
import sys
import tempfile
from urllib.request import urlopen

from pdf_ocr import DICTIONARY_SHA256, MODEL_NAME, matches_sha256, model_path, valid_model


def install_weights(destination):
    if valid_model(destination):
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    url = 'https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.10.0/onnx/PP-OCRv5/rec/' + MODEL_NAME
    staged = None
    try:
        with tempfile.NamedTemporaryFile(dir=destination.parent, delete=False) as target:
            staged = Path(target.name)
            with urlopen(url, timeout=30) as response:
                target.write(response.read(8 * 1024 * 1024))
        if not valid_model(staged):
            raise RuntimeError('PDF OCR model checksum mismatch')
        os.replace(staged, destination)
    finally:
        if staged is not None:
            staged.unlink(missing_ok=True)


def install_dictionary(model):
    import onnx

    destination = model.with_suffix('.txt')
    if matches_sha256(destination, DICTIONARY_SHA256):
        return
    metadata = onnx.load(model, load_external_data=False).metadata_props
    characters = next((entry.value for entry in metadata if entry.key == 'character'), '')
    staged = None
    try:
        with tempfile.NamedTemporaryFile(dir=destination.parent, delete=False) as target:
            staged = Path(target.name)
            target.write(characters.encode('utf-8'))
        if not matches_sha256(staged, DICTIONARY_SHA256):
            raise RuntimeError('Cyrillic OCR dictionary checksum mismatch')
        os.replace(staged, destination)
    finally:
        if staged is not None:
            staged.unlink(missing_ok=True)


def install(home):
    model = model_path(home)
    install_weights(model)
    install_dictionary(model)


if __name__ == '__main__':
    install(sys.argv[1])
