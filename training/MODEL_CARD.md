# YOLO26n Playing Card Detector — Model Card

## Overview

A YOLO26n (nano) model fine-tuned to detect 52 playing card classes in real-time.
Designed for browser inference via ONNX Runtime Web or TensorFlow.js.

## Architecture

- **Base model:** YOLO26n (nano)
- **Parameters:** 2,524,080
- **Input size:** 416x416
- **Output format:** `[1, 300, 6]` = `[cx, cy, w, h, confidence, class_id]`
- **NMS:** Not needed (end-to-end detection)
- **ONNX size:** 9.3 MB

## Training

- **Dataset:** Augmented Startups Playing Cards (Roboflow Universe)
- **Dataset URL:** https://universe.roboflow.com/augmented-startups/playing-cards-ow27d
- **Classes:** 52 (standard deck, no jokers)
- **Method:** Transfer learning from COCO-pretrained YOLO26n
- **Epochs:** 50
- **Batch size:** 512
- **Image size:** 416x416
- **Weights source:** `best.pt`

## Class Mapping

Alphabetical by rank, then by suit (same as PD-Mera convention):

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

## Export Formats

- **ONNX:** `card-detector.onnx` — for ONNX Runtime Web (WebGL2)
- **TF.js:** `card-detector-tfjs/` — for TensorFlow.js

## Usage

```bash
# Train
python train_card_detector.py download
python train_card_detector.py train
python train_card_detector.py export
python train_card_detector.py validate
```
