"""Prepare the pinned ONNX models used by the portable Basic processor."""
from pathlib import Path
import sys

from huggingface_hub import snapshot_download

destination = Path(sys.argv[1]) / 'models' / 'MinerU-4_models_onnx'
snapshot_download(
    repo_id='opendatalab/MinerU-4_models_onnx',
    revision='358310b4f64b95f9fefc372ad899356e4111f376',
    local_dir=destination,
    allow_patterns=[
        'Layout/PP-DocLayoutV2/inference.onnx',
        'Layout/PP-DocLayoutV2/inference.yml',
        'OCR/paddleocr/ch_PP-OCRv6_small_rec_infer.onnx',
        'OCR/paddleocr/ch_PP-OCRv6_tiny_det_infer.onnx',
        'OCR/paddleocr/seal_PP-OCRv4_det_infer.onnx',
        'Table/PP-LCNet_x1_0_table_cls.onnx',
        'Table/slanet-plus.onnx',
        'Table/unet.onnx',
        'README.md',
        'LICENSE*',
    ],
)
