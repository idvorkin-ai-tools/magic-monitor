# YOLO26s Playing Card Detector — Model Card

## Overview

A YOLO26s (small) model fine-tuned to detect 52 playing card classes in real-time.
Designed for browser inference via ONNX Runtime Web.

## Architecture

- **Base model:** YOLO26s (small)
- **Parameters:** ~9M
- **Input size:** 640x640
- **Output format:** `[1, 300, 6]` = `[x1, y1, x2, y2, confidence, class_id]` (corner coords in pixel space)
- **NMS:** Built into model (post-NMS output, max 300 detections)
- **ONNX size:** 36.5 MB

## Training

- **Dataset:** Augmented Startups Playing Cards (Roboflow Universe)
- **Dataset URL:** https://universe.roboflow.com/augmented-startups/playing-cards-ow27d
- **Classes:** 52 (standard deck, no jokers)
- **Method:** Transfer learning from COCO-pretrained YOLO26s
- **Epochs:** 50
- **Batch size:** 128
- **Image size:** 640x640
- **GPU:** A100
- **Weights source:** `best.pt`

## Evaluation (on test split, 1010 images, 4040 ground truth cards)

| Model | Input | Conf threshold | Recall | Precision | ONNX size |
|-------|-------|----------------|--------|-----------|-----------|
| **YOLO26s (current)** | **640x640** | **0.5** | **73.5%** | **97.6%** | **36.5 MB** |
| YOLO26n (previous) | 416x416 | 0.5 | 40.2% | 95.0% | 9.3 MB |

Upgrading from nano→small at 640x640 nearly doubled recall while improving precision.

### Inference speed (CPU, 50 images, includes preprocess + inference)

| Model | Python | Node.js |
|-------|--------|---------|
| **YOLO26s @ 640** | **108 ms / 9.3 FPS** | **116 ms / 8.6 FPS** |
| YOLO26n @ 416 | 25 ms / 39.7 FPS | 33 ms / 30.6 FPS |

~4x slower than nano due to 3.6x more parameters and 2.4x more pixels.
Browser with WASM backend + frame skipping (every other frame) = ~4-5 detection FPS,
which is adequate for playing cards.

## Class Mapping

Alphabetical by rank+suit (from Roboflow `data.yaml`):

| Index | Class | Card           |
| ----- | ----- | -------------- |
| 0     | 10C   | 10 of clubs    |
| 1     | 10D   | 10 of diamonds |
| 2     | 10H   | 10 of hearts   |
| 3     | 10S   | 10 of spades   |
| 4     | 2C    | 2 of clubs     |
| 5     | 2D    | 2 of diamonds  |
| 6     | 2H    | 2 of hearts    |
| 7     | 2S    | 2 of spades    |
| 8     | 3C    | 3 of clubs     |
| 9     | 3D    | 3 of diamonds  |
| 10    | 3H    | 3 of hearts    |
| 11    | 3S    | 3 of spades    |
| 12    | 4C    | 4 of clubs     |
| 13    | 4D    | 4 of diamonds  |
| 14    | 4H    | 4 of hearts    |
| 15    | 4S    | 4 of spades    |
| 16    | 5C    | 5 of clubs     |
| 17    | 5D    | 5 of diamonds  |
| 18    | 5H    | 5 of hearts    |
| 19    | 5S    | 5 of spades    |
| 20    | 6C    | 6 of clubs     |
| 21    | 6D    | 6 of diamonds  |
| 22    | 6H    | 6 of hearts    |
| 23    | 6S    | 6 of spades    |
| 24    | 7C    | 7 of clubs     |
| 25    | 7D    | 7 of diamonds  |
| 26    | 7H    | 7 of hearts    |
| 27    | 7S    | 7 of spades    |
| 28    | 8C    | 8 of clubs     |
| 29    | 8D    | 8 of diamonds  |
| 30    | 8H    | 8 of hearts    |
| 31    | 8S    | 8 of spades    |
| 32    | 9C    | 9 of clubs     |
| 33    | 9D    | 9 of diamonds  |
| 34    | 9H    | 9 of hearts    |
| 35    | 9S    | 9 of spades    |
| 36    | AC    | A of clubs     |
| 37    | AD    | A of diamonds  |
| 38    | AH    | A of hearts    |
| 39    | AS    | A of spades    |
| 40    | JC    | J of clubs     |
| 41    | JD    | J of diamonds  |
| 42    | JH    | J of hearts    |
| 43    | JS    | J of spades    |
| 44    | KC    | K of clubs     |
| 45    | KD    | K of diamonds  |
| 46    | KH    | K of hearts    |
| 47    | KS    | K of spades    |
| 48    | QC    | Q of clubs     |
| 49    | QD    | Q of diamonds  |
| 50    | QH    | Q of hearts    |
| 51    | QS    | Q of spades    |

## S3 Storage

Models are hosted on S3 and loaded at runtime:

| File | Model |
|------|-------|
| `s3://idvorkin-models/card-detector.onnx` | Current best (YOLO26s) |
| `s3://idvorkin-models/card-detector-yolo26s.onnx` | YOLO26s @ 640 |
| `s3://idvorkin-models/card-detector-yolo26n.onnx` | YOLO26n @ 416 (legacy) |

## Verification Scripts

```bash
# Python (requires: onnxruntime, opencv-python-headless, numpy)
cd training/
uv run --with onnxruntime --with opencv-python-headless --with numpy python3 verify_model.py

# Node.js (requires: onnxruntime-node, jpeg-js)
cd training/
npm install   # one-time
node verify_model_node.mjs
```

## Training

```bash
# Local
python train_card_detector.py download
python train_card_detector.py train          # YOLO26s @ 640 (default)
python train_card_detector.py export

# Google Colab (recommended for GPU)
# Open training/train_colab.ipynb
```
