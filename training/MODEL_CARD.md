# Card Detector Models

The current model is **YOLO26s @ 640x640**. See individual model cards for details:

- [MODEL_CARD_YOLO26S.md](MODEL_CARD_YOLO26S.md) — **Current** (73.5-97.9% recall, 36.5 MB)
- [MODEL_CARD_YOLO26N.md](MODEL_CARD_YOLO26N.md) — Legacy (40.2-74.8% recall, 9.3 MB)

## S3 Storage

| File | Model | Status |
|------|-------|--------|
| `card-detector-yolo26s.onnx` | YOLO26s @ 640 | **Current** |
| `card-detector-yolo26n.onnx` | YOLO26n @ 416 | Legacy |
| `card-detector.onnx` | Alias for current best | **Current** |
