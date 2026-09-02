#!/usr/bin/env python3
"""Generate a conservative single-speaker reframe plan for the isolated POC."""

import argparse
import json
import math
import subprocess
import time
from pathlib import Path

import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision


ANALYSIS_WIDTH = 480
SAMPLE_FPS = 5
FRAME_INTERVAL_MS = 1000 // SAMPLE_FPS
MIN_DETECTION_CONFIDENCE = 0.55
SAFE_FACE_WIDTH_MULTIPLIER = 1.45


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--segments", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args()


def probe_video(path):
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "json",
            path,
        ],
        check=True,
        capture_output=True,
        text=True,
        timeout=60,
    )
    stream = json.loads(result.stdout)["streams"][0]
    return int(stream["width"]), int(stream["height"])


def even(value):
    rounded = max(2, int(round(value)))
    return rounded if rounded % 2 == 0 else rounded + 1


def clamp(value, minimum, maximum):
    return max(minimum, min(maximum, value))


def face_box(detection, width, height):
    box = detection.bounding_box
    categories = detection.categories
    confidence = float(categories[0].score) if categories else 0.0
    return {
        "x": clamp(box.origin_x / width, 0.0, 1.0),
        "y": clamp(box.origin_y / height, 0.0, 1.0),
        "width": clamp(box.width / width, 0.0, 1.0),
        "height": clamp(box.height / height, 0.0, 1.0),
        "confidence": confidence,
    }


def center(box):
    return box["x"] + box["width"] / 2, box["y"] + box["height"] / 2


def select_primary(boxes, previous_center):
    if not boxes:
        return None
    if previous_center is None:
        return max(boxes, key=lambda item: item["width"] * item["height"])

    def track_score(item):
        x, y = center(item)
        distance = math.hypot(x - previous_center[0], y - previous_center[1])
        area = item["width"] * item["height"]
        return area * (1.0 - min(distance, 0.8) * 0.75)

    return max(boxes, key=track_score)


def crop_fraction(center_x, source_aspect):
    crop_width = min(1.0, (9.0 / 16.0) / source_aspect)
    if crop_width >= 0.999:
        return 0.5
    left = clamp(center_x - crop_width / 2.0, 0.0, 1.0 - crop_width)
    return left / (1.0 - crop_width)


def smooth_points(points):
    smoothed = []
    value = None
    for point in points:
        next_value = point["cropX"]
        if value is None:
            value = next_value
        elif abs(next_value - value) >= 0.015:
            value = value * 0.72 + next_value * 0.28
        smoothed.append({"timeMs": point["timeMs"], "cropX": round(value, 5)})
    return smoothed


def keyframes(points, duration_ms):
    if not points:
        return []
    selected = [points[0]]
    next_time = 1000
    for point in points[1:]:
        if point["timeMs"] >= next_time:
            selected.append(point)
            next_time = point["timeMs"] + 1000
    if selected[-1]["timeMs"] < duration_ms:
        selected.append({"timeMs": duration_ms, "cropX": selected[-1]["cropX"]})
    return selected


def analyze_segment(detector, source_path, segment, frame_width, frame_height, timestamp_base):
    duration_ms = segment["sourceEndMs"] - segment["sourceStartMs"]
    command = [
        "ffmpeg",
        "-hide_banner",
        "-nostdin",
        "-loglevel",
        "error",
        "-ss",
        f'{segment["sourceStartMs"] / 1000:.3f}',
        "-t",
        f"{duration_ms / 1000:.3f}",
        "-i",
        source_path,
        "-an",
        "-vf",
        f"fps={SAMPLE_FPS},scale={frame_width}:{frame_height}",
        "-pix_fmt",
        "rgb24",
        "-f",
        "rawvideo",
        "pipe:1",
    ]
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    frame_bytes = frame_width * frame_height * 3
    observations = []
    previous_center = None
    frame_index = 0
    ambiguous_frames = 0
    max_jump = 0.0

    while True:
        raw = process.stdout.read(frame_bytes)
        if not raw:
            break
        if len(raw) != frame_bytes:
            process.kill()
            raise RuntimeError("analysis_frame_incomplete")
        array = np.frombuffer(raw, dtype=np.uint8).reshape((frame_height, frame_width, 3))
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=array)
        timestamp_ms = timestamp_base + frame_index * FRAME_INTERVAL_MS
        result = detector.detect_for_video(image, timestamp_ms)
        boxes = [
            face_box(detection, frame_width, frame_height)
            for detection in result.detections
            if detection.categories and detection.categories[0].score >= MIN_DETECTION_CONFIDENCE
        ]
        boxes.sort(key=lambda item: item["width"] * item["height"], reverse=True)
        if len(boxes) > 1:
            largest = boxes[0]["width"] * boxes[0]["height"]
            second = boxes[1]["width"] * boxes[1]["height"]
            if largest > 0 and second / largest >= 0.6:
                ambiguous_frames += 1
        primary = select_primary(boxes, previous_center)
        if primary:
            next_center = center(primary)
            if previous_center is not None:
                max_jump = max(max_jump, abs(next_center[0] - previous_center[0]))
            previous_center = next_center
            observations.append({
                "timeMs": frame_index * FRAME_INTERVAL_MS,
                "centerX": next_center[0],
                "faceWidth": primary["width"],
                "confidence": primary["confidence"],
            })
        frame_index += 1

    stderr = process.stderr.read().decode("utf-8", errors="replace")
    if process.wait(timeout=30) != 0:
        raise RuntimeError(f"analysis_decode_failed:{stderr[:160]}")

    coverage = len(observations) / frame_index if frame_index else 0.0
    ambiguity = ambiguous_frames / frame_index if frame_index else 0.0
    average_confidence = (
        sum(item["confidence"] for item in observations) / len(observations)
        if observations
        else 0.0
    )
    maximum_face_width = max((item["faceWidth"] for item in observations), default=0.0)
    source_aspect = SOURCE_WIDTH / SOURCE_HEIGHT
    available_crop_width = min(1.0, (9.0 / 16.0) / source_aspect)
    face_fits = maximum_face_width * SAFE_FACE_WIDTH_MULTIPLIER <= available_crop_width
    reasons = []
    if coverage < 0.65:
        reasons.append("face_coverage_low")
    if ambiguity > 0.2:
        reasons.append("multiple_primary_faces")
    if max_jump > 0.28:
        reasons.append("subject_jump_large")
    if source_aspect < (9.0 / 16.0):
        reasons.append("source_narrower_than_canvas")
    if not face_fits:
        reasons.append("safe_crop_too_narrow")
    mode = "smart_crop" if not reasons else "fit_blur"
    confidence = clamp(
        coverage * 0.55 + (1.0 - ambiguity) * 0.2 + average_confidence * 0.25,
        0.0,
        1.0,
    )

    points = smooth_points([
        {
            "timeMs": item["timeMs"],
            "cropX": crop_fraction(item["centerX"], source_aspect),
        }
        for item in observations
    ])
    planned_keyframes = keyframes(points, duration_ms) if mode == "smart_crop" else []
    return {
        "segmentId": segment["id"],
        "mode": mode,
        "confidence": round(confidence, 4),
        "reasons": reasons if reasons else ["primary_face_stable"],
        "keyframes": planned_keyframes,
        "diagnostics": {
            "framesAnalyzed": frame_index,
            "faceDetectedFrames": len(observations),
            "ambiguousFrames": ambiguous_frames,
            "faceCoverage": round(coverage, 4),
            "maxHorizontalJump": round(max_jump, 4),
            "maxFaceWidth": round(maximum_face_width, 4),
        },
    }


args = parse_args()
SOURCE_WIDTH, SOURCE_HEIGHT = probe_video(args.input)
segments = json.loads(Path(args.segments).read_text(encoding="utf-8"))
started_at = time.perf_counter()
base_options = python.BaseOptions(model_asset_path=args.model)
options = vision.FaceDetectorOptions(
    base_options=base_options,
    running_mode=vision.RunningMode.VIDEO,
    min_detection_confidence=MIN_DETECTION_CONFIDENCE,
    min_suppression_threshold=0.3,
)

plans = []
timestamp_base = 0
with vision.FaceDetector.create_from_options(options) as detector:
    frame_height = even(SOURCE_HEIGHT * ANALYSIS_WIDTH / SOURCE_WIDTH)
    for segment in sorted(segments, key=lambda item: item["order"]):
        plan = analyze_segment(
            detector,
            args.input,
            segment,
            ANALYSIS_WIDTH,
            frame_height,
            timestamp_base,
        )
        plans.append(plan)
        timestamp_base += segment["sourceEndMs"] - segment["sourceStartMs"] + 1000

output = {
    "schemaVersion": 1,
    "analyzer": {
        "name": "mediapipe-face-detector",
        "sampleFps": SAMPLE_FPS,
        "analysisWidth": ANALYSIS_WIDTH,
        "modelSha256": "3698b18f063835bc609069ef052228fbe86d9c9a6dc8dcb7c7c2d69aed2b181b",
    },
    "analysisMs": round((time.perf_counter() - started_at) * 1000),
    "segments": plans,
}
Path(args.output).write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
