"""Verify the YOLO26n card detector ONNX model against test images.

Usage:
    cd training/
    uv run --with onnxruntime --with opencv-python-headless --with numpy python3 verify_model.py
"""

import glob
import os

import cv2
import numpy as np
import onnxruntime as ort

CLASSES = [
    "10C","10D","10H","10S","2C","2D","2H","2S","3C","3D","3H","3S",
    "4C","4D","4H","4S","5C","5D","5H","5S","6C","6D","6H","6S",
    "7C","7D","7H","7S","8C","8D","8H","8S","9C","9D","9H","9S",
    "AC","AD","AH","AS","JC","JD","JH","JS","KC","KD","KH","KS",
    "QC","QD","QH","QS",
]

CONF_THRESHOLD = 0.5
MODEL_PATH = "card-detector.onnx"
TEST_IMAGES = "dataset/test/images"
TEST_LABELS = "dataset/test/labels"


def preprocess(img: np.ndarray, size: int = 416) -> np.ndarray:
    """Resize, normalize, and transpose to NCHW float32."""
    resized = cv2.resize(img, (size, size))
    blob = resized.astype(np.float32) / 255.0
    blob = blob.transpose(2, 0, 1)  # HWC -> CHW
    return blob[np.newaxis]  # add batch dim


def parse_detections(output: np.ndarray, conf_threshold: float = CONF_THRESHOLD):
    """Parse [1, 300, 6] output into list of (class_id, confidence, x, y, w, h)."""
    dets = output[0]  # remove batch dim -> [300, 6]
    results = []
    for det in dets:
        x, y, w, h, conf, cls_id = det
        if conf >= conf_threshold:
            results.append((int(cls_id), float(conf), x, y, w, h))
    return results


def parse_yolo_label(label_path: str):
    """Parse YOLO format label file -> list of (class_id,)."""
    labels = []
    if not os.path.exists(label_path):
        return labels
    with open(label_path) as f:
        for line in f:
            parts = line.strip().split()
            if parts:
                labels.append(int(parts[0]))
    return labels


def main():
    sess = ort.InferenceSession(MODEL_PATH)
    input_name = sess.get_inputs()[0].name

    image_files = sorted(glob.glob(os.path.join(TEST_IMAGES, "*.jpg")))
    if not image_files:
        print("No test images found!")
        return

    total = 0
    correct = 0
    missed = 0
    false_positives = 0

    for img_path in image_files:
        img = cv2.imread(img_path)
        if img is None:
            continue

        blob = preprocess(img)
        output = sess.run(None, {input_name: blob})[0]
        dets = parse_detections(output)

        # Get ground truth
        base = os.path.splitext(os.path.basename(img_path))[0]
        label_path = os.path.join(TEST_LABELS, base + ".txt")
        gt_classes = parse_yolo_label(label_path)

        pred_classes = [d[0] for d in dets]

        # Simple class-level matching (not IoU-based, just checking if right classes detected)
        gt_set = sorted(gt_classes)
        pred_set = sorted(pred_classes)

        for gt_cls in gt_set:
            total += 1
            if gt_cls in pred_set:
                correct += 1
                pred_set.remove(gt_cls)
            else:
                missed += 1

        false_positives += len(pred_set)

    print(f"\n{'='*50}")
    print(f"Card Detector Verification Results")
    print(f"{'='*50}")
    print(f"Test images:       {len(image_files)}")
    print(f"Ground truth cards: {total}")
    print(f"Correct detections: {correct}")
    print(f"Missed:            {missed}")
    print(f"False positives:   {false_positives}")
    if total > 0:
        recall = correct / total * 100
        precision = correct / (correct + false_positives) * 100 if (correct + false_positives) > 0 else 0
        print(f"Recall:            {recall:.1f}%")
        print(f"Precision:         {precision:.1f}%")
    print(f"{'='*50}")

    # Show a few example detections
    print("\nSample detections (first 5 images):")
    for img_path in image_files[:5]:
        img = cv2.imread(img_path)
        blob = preprocess(img)
        output = sess.run(None, {input_name: blob})[0]
        dets = parse_detections(output)

        base = os.path.splitext(os.path.basename(img_path))[0]
        label_path = os.path.join(TEST_LABELS, base + ".txt")
        gt_classes = parse_yolo_label(label_path)

        gt_names = [CLASSES[c] for c in gt_classes if c < len(CLASSES)]
        pred_names = [f"{CLASSES[d[0]]}({d[1]:.2f})" for d in dets if d[0] < len(CLASSES)]

        print(f"  {os.path.basename(img_path)[:30]:30s} GT: {gt_names}  Pred: {pred_names}")


if __name__ == "__main__":
    main()
