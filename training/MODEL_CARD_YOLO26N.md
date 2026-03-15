# YOLO26n Playing Card Detector — Model Card (Legacy)

## Overview

A YOLO26n (nano) model fine-tuned to detect 52 playing card classes.
**Superseded by YOLO26s** — kept for reference and size-constrained deployments.

## Architecture

- **Base model:** YOLO26n (nano)
- **Parameters:** 2,524,080
- **Input size:** 416x416
- **Output format:** `[1, 300, 6]` = `[x1, y1, x2, y2, confidence, class_id]`
- **NMS:** Built into model (post-NMS output, max 300 detections)
- **ONNX size:** 9.3 MB

## Training

- **Dataset:** Augmented Startups Playing Cards (Roboflow Universe)
- **Classes:** 52 (standard deck, no jokers)
- **Method:** Transfer learning from COCO-pretrained YOLO26n
- **Epochs:** 50
- **Batch size:** 16
- **Image size:** 416x416

## Evaluation (test split, 1010 images, 4040 ground truth cards)

| Runtime | Resize method | Recall | Precision |
|---------|---------------|--------|-----------|
| Node.js (nearest-neighbor) | nearest | 74.8% | 94.3% |
| Python (cv2 bilinear) | bilinear | 40.2% | 95.0% |

## S3

`s3://idvorkin-models/card-detector-yolo26n.onnx`
