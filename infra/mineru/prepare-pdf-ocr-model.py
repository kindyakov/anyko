"""Install the pinned OCR weights at build/setup time, outside document processing."""
import os
from pathlib import Path
import sys
import tempfile
from urllib.request import urlopen

from pdf_ocr import MODEL_NAME, model_path, valid_model


def install(home):
    destination = model_path(home)
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


if __name__ == '__main__':
    install(sys.argv[1])
