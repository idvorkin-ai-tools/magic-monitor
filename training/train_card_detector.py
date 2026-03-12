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
        print(
            f"Training YOLO26n for {args.epochs} epochs, batch={args.batch}, imgsz={MODEL_INPUT_SIZE}"
        )
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


def cmd_validate(args):
    """Validate exported ONNX model output format and class mapping."""
    try:
        import numpy as np
        import onnxruntime as ort
    except ImportError as e:
        print(f"ERROR: Missing dependency: {e.name}")
        print("  Run: pip install -r training/requirements.txt")
        sys.exit(1)

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
    print("\n--- Model Info ---")
    for inp in inputs:
        print(f"Input:  {inp.name} shape={inp.shape} dtype={inp.type}")
    for out in outputs:
        print(f"Output: {out.name} shape={out.shape} dtype={out.type}")

    # Create dummy input
    input_shape = inputs[0].shape
    # Replace dynamic dims with actual values
    shape = [
        d if isinstance(d, int) else MODEL_INPUT_SIZE if i > 1 else 1
        for i, d in enumerate(input_shape)
    ]
    dummy = np.random.randn(*shape).astype(np.float32)

    # Run inference
    result = session.run(None, {inputs[0].name: dummy})
    print("\n--- Output Tensors ---")
    for i, (out, tensor) in enumerate(zip(outputs, result)):
        print(f"Output[{i}] '{out.name}': shape={tensor.shape} dtype={tensor.dtype}")

    output = result[0]
    print("\n--- Output Analysis ---")
    print(f"Shape: {output.shape}")

    # Analyze output format
    needs_nms = _analyze_output_shape(output)

    print(
        f"\nNMS needed: {'YES — keep nms() in CardDetectorService.ts' if needs_nms else 'NO — can remove nms() and computeIoU()'}"
    )

    # Try with a real image if available
    test_image = _find_test_image(args.image)
    if test_image:
        _validate_with_image(session, inputs[0].name, test_image)

    # Print class mapping from data.yaml
    _print_class_mapping()


def _analyze_output_shape(output, num_classes=52):
    """Analyze output tensor shape and report format."""
    if len(output.shape) == 3:
        batch, dim1, dim2 = output.shape

        # YOLO26 end-to-end: [1, max_detections, 6] where 6 = cx,cy,w,h,conf,class_id
        if dim2 == 6:
            print(
                f"Format: YOLO26 end-to-end [batch={batch}, max_detections={dim1}, features={dim2}]"
            )
            print("Features: [cx, cy, w, h, confidence, class_id]")
            print("Model outputs final detections directly — no NMS needed!")
            return False

        # YOLOv8-style transposed: [1, 4+num_classes, num_predictions]
        if dim1 == 4 + num_classes:
            print(
                f"Format: YOLOv8-style transposed [batch={batch}, features={dim1}, predictions={dim2}]"
            )
            print(f"Features breakdown: 4 bbox + {num_classes} classes")
            return True

        # Fallback heuristic
        if dim2 > dim1:
            print(
                f"Format: Likely YOLOv8-style transposed [batch={batch}, features={dim1}, predictions={dim2}]"
            )
            return True
        else:
            print(
                f"Format: Likely end-to-end [batch={batch}, predictions={dim1}, features={dim2}]"
            )
            return False
    elif len(output.shape) == 2:
        num_preds, num_features = output.shape
        print(f"Format: 2D [predictions={num_preds}, features={num_features}]")
        return False
    else:
        print(f"Unexpected shape: {output.shape}")
        return None


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


def _validate_with_image(session, input_name, image_path):
    """Run inference on a real image and report detections."""
    import numpy as np

    try:
        from PIL import Image
    except ImportError:
        print("\nSkipping real image test (pip install Pillow)")
        return

    print(f"\n--- Test Image: {image_path.name} ---")
    img = Image.open(image_path).convert("RGB")
    img_resized = img.resize((MODEL_INPUT_SIZE, MODEL_INPUT_SIZE))

    # Normalize to [0, 1] and reshape to NCHW
    arr = np.array(img_resized, dtype=np.float32) / 255.0
    arr = arr.transpose(2, 0, 1)  # HWC -> CHW
    arr = np.expand_dims(arr, 0)  # -> NCHW

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
            print(
                f"  {d['label']:12s}  conf={d['confidence']:.3f}  bbox=({d['cx']:.2f}, {d['cy']:.2f}, {d['w']:.2f}, {d['h']:.2f})"
            )
    else:
        print("No detections above 0.25 confidence (normal for random test image)")


def _parse_output(output, class_names):
    """Parse YOLO output tensor into detections. Handles multiple output formats."""
    threshold = 0.25
    detections = []

    if len(output.shape) != 3:
        return detections

    _batch, dim1, dim2 = output.shape
    data = output[0]

    # YOLO26 end-to-end: [1, 300, 6] = [cx, cy, w, h, confidence, class_id]
    if dim2 == 6:
        for i in range(dim1):
            row = data[i]
            confidence = float(row[4])
            if confidence < threshold:
                continue
            class_id = int(row[5])
            cx = float(row[0]) / MODEL_INPUT_SIZE
            cy = float(row[1]) / MODEL_INPUT_SIZE
            w = float(row[2]) / MODEL_INPUT_SIZE
            h = float(row[3]) / MODEL_INPUT_SIZE
            label = (
                class_names[class_id]
                if class_id < len(class_names)
                else f"class_{class_id}"
            )
            detections.append(
                {
                    "label": label,
                    "confidence": confidence,
                    "cx": cx,
                    "cy": cy,
                    "w": w,
                    "h": h,
                }
            )

    # YOLOv8-style transposed: [1, 4+num_classes, num_predictions]
    elif dim2 < dim1 and dim2 != 6:
        import numpy as np

        num_classes = len(class_names) if class_names else 52
        for i in range(dim2):
            class_scores = data[4 : 4 + num_classes, i]
            max_idx = int(np.argmax(class_scores))
            confidence = float(class_scores[max_idx])
            if confidence < threshold:
                continue
            cx = float(data[0, i]) / MODEL_INPUT_SIZE
            cy = float(data[1, i]) / MODEL_INPUT_SIZE
            w = float(data[2, i]) / MODEL_INPUT_SIZE
            h = float(data[3, i]) / MODEL_INPUT_SIZE
            label = (
                class_names[max_idx]
                if max_idx < len(class_names)
                else f"class_{max_idx}"
            )
            detections.append(
                {
                    "label": label,
                    "confidence": confidence,
                    "cx": cx,
                    "cy": cy,
                    "w": w,
                    "h": h,
                }
            )

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

    for i, name in enumerate(names):
        print(f"  {i:3d}: {name}")

    print("\n--- Suggested TypeScript CLASS_MAP order ---")
    print("// Generated from training data.yaml")
    print("// Verify this matches your Roboflow dataset class order")
    print(f"// Total classes: {len(names)}")


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
    tr.add_argument(
        "--epochs", type=int, default=50, help="Training epochs (default: 50)"
    )
    tr.add_argument(
        "--batch", type=int, default=16, help="Batch size (default: 16)"
    )
    tr.add_argument(
        "--resume", action="store_true", help="Resume from last checkpoint"
    )
    tr.set_defaults(func=cmd_train)

    # export
    ex = subparsers.add_parser("export", help="Export best weights to ONNX")
    ex.add_argument(
        "--weights",
        type=str,
        default=None,
        help="Path to weights (default: auto-find best.pt)",
    )
    ex.set_defaults(func=cmd_export)

    # validate
    va = subparsers.add_parser("validate", help="Validate ONNX model output")
    va.add_argument(
        "--model",
        type=str,
        default=None,
        help="Path to ONNX file (default: card-detector.onnx)",
    )
    va.add_argument(
        "--image",
        type=str,
        default=None,
        help="Path to test image (default: pick from dataset)",
    )
    va.set_defaults(func=cmd_validate)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
