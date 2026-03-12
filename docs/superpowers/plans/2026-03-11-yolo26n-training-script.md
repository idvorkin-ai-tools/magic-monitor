# YOLO26n Card Detector Training Script

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a Python training script that downloads a playing card dataset, trains YOLO26n, exports to ONNX, and validates the output format for browser integration.

**Architecture:** Single CLI script (`train_card_detector.py`) with 4 subcommands: `download`, `train`, `export`, `validate`. Uses `argparse` for CLI, Ultralytics for training/export, Roboflow SDK for dataset download, ONNX Runtime for validation inference.

**Tech Stack:** Python 3.10+, ultralytics, roboflow, onnxruntime, argparse

---

## File Structure

```
training/
  train_card_detector.py    # Main CLI script with 4 subcommands
  requirements.txt          # Python dependencies
  dataset/                  # Downloaded by 'download' command (gitignored)
  runs/                     # Training output (gitignored)
```

**Modify:**

- `.gitignore` — add `training/dataset/`, `training/runs/`, `*.onnx` (in training dir)

---

## Chunk 1: Project Setup and Dataset Download

### Task 1: Create training directory and requirements.txt

**Files:**

- Create: `training/requirements.txt`
- Modify: `.gitignore`

- [ ] **Step 1: Create requirements.txt**

```
ultralytics>=8.3
roboflow
onnxruntime
```

- [ ] **Step 2: Add training gitignore entries**

Add to `.gitignore`:

```
# Training artifacts
training/dataset/
training/runs/
training/*.onnx
```

- [ ] **Step 3: Commit**

```bash
git add training/requirements.txt .gitignore
git commit -m "chore: add training directory with requirements"
```

---

### Task 2: Create script skeleton with argparse CLI

**Files:**

- Create: `training/train_card_detector.py`

- [ ] **Step 1: Write the script skeleton**

```python
#!/usr/bin/env python3
"""
Train a YOLO26n playing card detector and export to ONNX for browser use.

Usage:
    python train_card_detector.py download   # Download dataset via Roboflow API
    python train_card_detector.py train      # Train YOLO26n
    python train_card_detector.py export     # Export best weights to ONNX
    python train_card_detector.py validate   # Validate ONNX output format

Requires ROBOFLOW_API_KEY environment variable for download command.
"""

import argparse
import os
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
DATASET_DIR = SCRIPT_DIR / "dataset"
RUNS_DIR = SCRIPT_DIR / "runs"
MODEL_INPUT_SIZE = 416
ONNX_OUTPUT = SCRIPT_DIR / "card-detector.onnx"
PUBLIC_MODELS_DIR = SCRIPT_DIR.parent / "public" / "models"


def cmd_download(args):
    """Download playing card dataset from Roboflow."""
    print("TODO: implement download")


def cmd_train(args):
    """Train YOLO26n on the playing card dataset."""
    print("TODO: implement train")


def cmd_export(args):
    """Export trained model to ONNX format."""
    print("TODO: implement export")


def cmd_validate(args):
    """Validate exported ONNX model output format."""
    print("TODO: implement validate")


def main():
    parser = argparse.ArgumentParser(
        description="Train YOLO26n playing card detector for browser inference"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # download
    dl = subparsers.add_parser("download", help="Download dataset from Roboflow")
    dl.set_defaults(func=cmd_download)

    # train
    tr = subparsers.add_parser("train", help="Train YOLO26n on card dataset")
    tr.add_argument("--epochs", type=int, default=50, help="Training epochs (default: 50)")
    tr.add_argument("--batch", type=int, default=16, help="Batch size (default: 16)")
    tr.add_argument("--resume", action="store_true", help="Resume from last checkpoint")
    tr.set_defaults(func=cmd_train)

    # export
    ex = subparsers.add_parser("export", help="Export best weights to ONNX")
    ex.add_argument("--weights", type=str, default=None, help="Path to weights (default: auto-find best.pt)")
    ex.set_defaults(func=cmd_export)

    # validate
    va = subparsers.add_parser("validate", help="Validate ONNX model output")
    va.add_argument("--model", type=str, default=None, help="Path to ONNX file (default: card-detector.onnx)")
    va.add_argument("--image", type=str, default=None, help="Path to test image (default: pick from dataset)")
    va.set_defaults(func=cmd_validate)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify it runs**

Run: `cd training && python train_card_detector.py --help`
Expected: Shows help with 4 subcommands.

Run: `python train_card_detector.py download`
Expected: Prints "TODO: implement download"

- [ ] **Step 3: Commit**

```bash
git add training/train_card_detector.py
git commit -m "feat: add training script skeleton with CLI subcommands"
```

---

### Task 3: Implement download command

**Files:**

- Modify: `training/train_card_detector.py` — `cmd_download` function

- [ ] **Step 1: Implement cmd_download**

Replace the `cmd_download` function:

```python
def cmd_download(args):
    """Download playing card dataset from Roboflow."""
    api_key = os.environ.get("ROBOFLOW_API_KEY")
    if not api_key:
        print("ERROR: Set ROBOFLOW_API_KEY environment variable.")
        print("  Get a free key at https://app.roboflow.com/settings/api")
        sys.exit(1)

    from roboflow import Roboflow

    rf = Roboflow(api_key=api_key)
    project = rf.workspace("augmented-startups").project("playing-cards-ow27d")
    version = project.version(4)

    print(f"Downloading dataset to {DATASET_DIR}...")
    version.download("yolov8", location=str(DATASET_DIR))
    print(f"Dataset downloaded to {DATASET_DIR}")

    # Print class names for verification
    data_yaml = DATASET_DIR / "data.yaml"
    if data_yaml.exists():
        import yaml
        with open(data_yaml) as f:
            data = yaml.safe_load(f)
        names = data.get("names", [])
        print(f"\nDataset has {len(names)} classes:")
        for i, name in enumerate(names):
            print(f"  {i}: {name}")
```

- [ ] **Step 2: Test with dry run (verify API key check)**

Run: `unset ROBOFLOW_API_KEY && python train_card_detector.py download`
Expected: "ERROR: Set ROBOFLOW_API_KEY environment variable."

- [ ] **Step 3: Commit**

```bash
git add training/train_card_detector.py
git commit -m "feat: implement dataset download via Roboflow API"
```

---

## Chunk 2: Train and Export Commands

### Task 4: Implement train command

**Files:**

- Modify: `training/train_card_detector.py` — `cmd_train` function

- [ ] **Step 1: Implement cmd_train**

Replace the `cmd_train` function:

```python
def cmd_train(args):
    """Train YOLO26n on the playing card dataset."""
    data_yaml = DATASET_DIR / "data.yaml"
    if not data_yaml.exists():
        print(f"ERROR: Dataset not found at {DATASET_DIR}")
        print("  Run: python train_card_detector.py download")
        sys.exit(1)

    from ultralytics import YOLO

    if args.resume:
        last_pt = _find_last_checkpoint()
        if not last_pt:
            print("ERROR: No checkpoint found to resume from.")
            sys.exit(1)
        print(f"Resuming from {last_pt}")
        model = YOLO(str(last_pt))
        model.train(resume=True)
    else:
        model = YOLO("yolo26n.pt")
        print(f"Training YOLO26n for {args.epochs} epochs, batch={args.batch}, imgsz={MODEL_INPUT_SIZE}")
        model.train(
            data=str(data_yaml),
            epochs=args.epochs,
            imgsz=MODEL_INPUT_SIZE,
            batch=args.batch,
            project=str(RUNS_DIR),
            name="cards-yolo26n",
            exist_ok=True,
        )

    print(f"\nTraining complete. Weights saved to {RUNS_DIR}/cards-yolo26n/weights/")


def _find_last_checkpoint():
    """Find the last training checkpoint."""
    last = RUNS_DIR / "cards-yolo26n" / "weights" / "last.pt"
    return last if last.exists() else None
```

- [ ] **Step 2: Verify error handling**

Run: `python train_card_detector.py train` (without dataset downloaded)
Expected: "ERROR: Dataset not found..."

- [ ] **Step 3: Commit**

```bash
git add training/train_card_detector.py
git commit -m "feat: implement YOLO26n training command"
```

---

### Task 5: Implement export command

**Files:**

- Modify: `training/train_card_detector.py` — `cmd_export` function

- [ ] **Step 1: Implement cmd_export**

Replace the `cmd_export` function:

```python
def cmd_export(args):
    """Export trained model to ONNX format."""
    if args.weights:
        weights_path = Path(args.weights)
    else:
        weights_path = RUNS_DIR / "cards-yolo26n" / "weights" / "best.pt"

    if not weights_path.exists():
        print(f"ERROR: Weights not found at {weights_path}")
        print("  Run: python train_card_detector.py train")
        sys.exit(1)

    from ultralytics import YOLO

    model = YOLO(str(weights_path))
    print(f"Exporting {weights_path} to ONNX (imgsz={MODEL_INPUT_SIZE}, simplified)...")
    export_path = model.export(format="onnx", imgsz=MODEL_INPUT_SIZE, simplify=True)

    # Copy to expected location
    import shutil
    shutil.copy2(export_path, ONNX_OUTPUT)
    print(f"ONNX model saved to {ONNX_OUTPUT}")

    size_mb = ONNX_OUTPUT.stat().st_size / (1024 * 1024)
    print(f"Model size: {size_mb:.1f} MB")

    # Also copy to public/models if it exists
    if PUBLIC_MODELS_DIR.exists():
        dest = PUBLIC_MODELS_DIR / "card-detector.onnx"
        shutil.copy2(ONNX_OUTPUT, dest)
        print(f"Copied to {dest}")
```

- [ ] **Step 2: Verify error handling**

Run: `python train_card_detector.py export` (without training)
Expected: "ERROR: Weights not found..."

- [ ] **Step 3: Commit**

```bash
git add training/train_card_detector.py
git commit -m "feat: implement ONNX export command"
```

---

## Chunk 3: Validate Command

### Task 6: Implement validate command

This is the most important command — it tells us if the YOLO26 output format differs from YOLOv8 and what class mapping to use.

**Files:**

- Modify: `training/train_card_detector.py` — `cmd_validate` function

- [ ] **Step 1: Implement cmd_validate**

Replace the `cmd_validate` function:

```python
def cmd_validate(args):
    """Validate exported ONNX model output format and class mapping."""
    import numpy as np
    import onnxruntime as ort

    model_path = Path(args.model) if args.model else ONNX_OUTPUT
    if not model_path.exists():
        print(f"ERROR: ONNX model not found at {model_path}")
        print("  Run: python train_card_detector.py export")
        sys.exit(1)

    # Load ONNX model
    print(f"Loading {model_path}...")
    session = ort.InferenceSession(str(model_path))

    # Print model info
    inputs = session.get_inputs()
    outputs = session.get_outputs()
    print(f"\n--- Model Info ---")
    for inp in inputs:
        print(f"Input:  {inp.name} shape={inp.shape} dtype={inp.type}")
    for out in outputs:
        print(f"Output: {out.name} shape={out.shape} dtype={out.type}")

    # Create dummy input
    input_shape = inputs[0].shape
    # Replace dynamic dims with actual values
    shape = [d if isinstance(d, int) else MODEL_INPUT_SIZE if i > 1 else 1 for i, d in enumerate(input_shape)]
    dummy = np.random.randn(*shape).astype(np.float32)

    # Run inference
    result = session.run(None, {inputs[0].name: dummy})
    print(f"\n--- Output Tensors ---")
    for i, (out, tensor) in enumerate(zip(outputs, result)):
        print(f"Output[{i}] '{out.name}': shape={tensor.shape} dtype={tensor.dtype}")

    output = result[0]
    print(f"\n--- Output Analysis ---")
    print(f"Shape: {output.shape}")

    # Analyze output format
    if len(output.shape) == 3:
        batch, dim1, dim2 = output.shape
        if dim1 > dim2:
            # Shape [1, num_features, num_predictions] — YOLOv8 style (transposed)
            num_features = dim1
            num_preds = dim2
            print(f"Format: YOLOv8-style transposed [batch={batch}, features={num_features}, predictions={num_preds}]")
            print(f"Features breakdown: 4 bbox + {num_features - 4} classes")
            needs_nms = True
        else:
            # Shape [1, num_predictions, num_features] — end-to-end style
            num_preds = dim1
            num_features = dim2
            print(f"Format: End-to-end [batch={batch}, predictions={num_preds}, features={num_features}]")
            print(f"Features breakdown: likely 4 bbox + 1 conf + {num_features - 5} classes (or 4 bbox + {num_features - 4} classes)")
            needs_nms = False
    elif len(output.shape) == 2:
        num_preds, num_features = output.shape
        print(f"Format: 2D [predictions={num_preds}, features={num_features}]")
        needs_nms = False
    else:
        print(f"Unexpected shape: {output.shape}")
        needs_nms = None

    print(f"\nNMS needed: {'YES — keep nms() in CardDetectorService.ts' if needs_nms else 'NO — can remove nms() and computeIoU()'}")

    # Try with a real image if available
    test_image = _find_test_image(args.image)
    if test_image:
        _validate_with_image(session, inputs[0].name, test_image, output.shape)

    # Print class mapping from data.yaml
    _print_class_mapping()


def _find_test_image(explicit_path):
    """Find a test image to validate with."""
    if explicit_path:
        p = Path(explicit_path)
        return p if p.exists() else None

    # Look in dataset test/valid directories
    for split in ["test", "valid", "train"]:
        img_dir = DATASET_DIR / split / "images"
        if img_dir.exists():
            images = list(img_dir.glob("*.jpg")) + list(img_dir.glob("*.png"))
            if images:
                return images[0]
    return None


def _validate_with_image(session, input_name, image_path, output_shape):
    """Run inference on a real image and report detections."""
    import numpy as np

    try:
        from PIL import Image
    except ImportError:
        print(f"\nSkipping real image test (pip install Pillow)")
        return

    print(f"\n--- Test Image: {image_path.name} ---")
    img = Image.open(image_path).convert("RGB")
    img_resized = img.resize((MODEL_INPUT_SIZE, MODEL_INPUT_SIZE))

    # Normalize to [0, 1] and reshape to NCHW
    arr = np.array(img_resized, dtype=np.float32) / 255.0
    arr = arr.transpose(2, 0, 1)  # HWC -> CHW
    arr = np.expand_dims(arr, 0)   # -> NCHW

    result = session.run(None, {input_name: arr})
    output = result[0]

    # Load class names
    data_yaml = DATASET_DIR / "data.yaml"
    class_names = []
    if data_yaml.exists():
        import yaml
        with open(data_yaml) as f:
            data = yaml.safe_load(f)
        class_names = data.get("names", [])

    # Parse detections based on shape
    detections = _parse_output(output, class_names)
    if detections:
        print(f"Found {len(detections)} detections (confidence > 0.25):")
        for d in detections[:10]:
            print(f"  {d['label']:12s}  conf={d['confidence']:.3f}  bbox=({d['cx']:.2f}, {d['cy']:.2f}, {d['w']:.2f}, {d['h']:.2f})")
    else:
        print("No detections above 0.25 confidence (normal for random test image)")


def _parse_output(output, class_names):
    """Parse YOLO output tensor into detections. Handles both transposed and normal formats."""
    import numpy as np

    num_classes = len(class_names) if class_names else 52
    threshold = 0.25

    if len(output.shape) == 3:
        batch, dim1, dim2 = output.shape
        if dim1 > dim2:
            # YOLOv8-style transposed: [1, 4+num_classes, num_predictions]
            data = output[0]  # [features, predictions]
            num_preds = dim2
            detections = []
            for i in range(num_preds):
                class_scores = data[4:4+num_classes, i]
                max_idx = np.argmax(class_scores)
                confidence = class_scores[max_idx]
                if confidence < threshold:
                    continue
                cx = data[0, i] / MODEL_INPUT_SIZE
                cy = data[1, i] / MODEL_INPUT_SIZE
                w = data[2, i] / MODEL_INPUT_SIZE
                h = data[3, i] / MODEL_INPUT_SIZE
                label = class_names[max_idx] if max_idx < len(class_names) else f"class_{max_idx}"
                detections.append({"label": label, "confidence": float(confidence), "cx": cx, "cy": cy, "w": w, "h": h})
        else:
            # End-to-end: [1, num_predictions, features]
            data = output[0]  # [predictions, features]
            num_preds = dim1
            detections = []
            # Try format: [cx, cy, w, h, conf, class_scores...] or [cx, cy, w, h, class_scores...]
            num_features = dim2
            has_obj_conf = (num_features == 5 + num_classes)
            class_offset = 5 if has_obj_conf else 4

            for i in range(num_preds):
                row = data[i]
                class_scores = row[class_offset:class_offset+num_classes]
                max_idx = np.argmax(class_scores)
                confidence = float(class_scores[max_idx])
                if has_obj_conf:
                    confidence *= float(row[4])
                if confidence < threshold:
                    continue
                cx = row[0] / MODEL_INPUT_SIZE
                cy = row[1] / MODEL_INPUT_SIZE
                w = row[2] / MODEL_INPUT_SIZE
                h = row[3] / MODEL_INPUT_SIZE
                label = class_names[max_idx] if max_idx < len(class_names) else f"class_{max_idx}"
                detections.append({"label": label, "confidence": float(confidence), "cx": cx, "cy": cy, "w": w, "h": h})

    detections.sort(key=lambda d: d["confidence"], reverse=True)
    return detections


def _print_class_mapping():
    """Print class mapping from data.yaml for updating cards.ts."""
    data_yaml = DATASET_DIR / "data.yaml"
    if not data_yaml.exists():
        print("\nNo data.yaml found — cannot print class mapping.")
        return

    import yaml
    with open(data_yaml) as f:
        data = yaml.safe_load(f)
    names = data.get("names", [])

    print(f"\n--- Class Mapping ({len(names)} classes) ---")
    print("Use this to update classIndexToCard() in src/types/cards.ts:\n")

    # Print raw mapping
    for i, name in enumerate(names):
        print(f"  {i:3d}: {name}")

    # Try to generate TypeScript mapping hint
    print("\n--- Suggested TypeScript CLASS_MAP order ---")
    print("// Generated from training data.yaml")
    print("// Verify this matches your Roboflow dataset class order")
    print(f"// Total classes: {len(names)}")
```

- [ ] **Step 2: Verify error handling**

Run: `python train_card_detector.py validate` (without ONNX model)
Expected: "ERROR: ONNX model not found..."

- [ ] **Step 3: Commit**

```bash
git add training/train_card_detector.py
git commit -m "feat: implement ONNX validation command with output format analysis"
```

---

### Task 7: Final review and test full CLI

- [ ] **Step 1: Verify all commands show proper help**

Run: `python train_card_detector.py --help`
Run: `python train_card_detector.py download --help`
Run: `python train_card_detector.py train --help`
Run: `python train_card_detector.py export --help`
Run: `python train_card_detector.py validate --help`

- [ ] **Step 2: Verify error paths for all commands**

Run: `python train_card_detector.py download` (without API key)
Run: `python train_card_detector.py train` (without dataset)
Run: `python train_card_detector.py export` (without weights)
Run: `python train_card_detector.py validate` (without ONNX)

All should give clear error messages with instructions.

- [ ] **Step 3: Final commit**

```bash
git add -A training/
git commit -m "feat: complete YOLO26n training script (issue #53)"
```
