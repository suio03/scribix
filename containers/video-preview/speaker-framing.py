#!/usr/bin/env python3
"""Bounded CPU analysis: MediaPipe faces + TalkNet audiovisual speaking scores.
Only crop decisions leave the process; face images, audio and tracks are temporary.
"""
import argparse
import json
import os
import re
import subprocess
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

FPS = 25
WINDOW_FRAMES = 50
DETECT_EVERY = 5


def face_crop(frame, box):
    x, y, width, height = box
    radius = max(width, height) / 2
    padding = int(radius * 1.8)
    center_x, center_y = x + width / 2 + padding, y + height / 2 + padding
    padded = np.pad(frame, ((padding, padding), (padding, padding), (0, 0)), constant_values=110)
    face = padded[int(center_y-radius):int(center_y+radius*1.8),
                  int(center_x-radius*1.4):int(center_x+radius*1.4)]
    # Match the author's demo preprocessing; the model expects 112px grayscale.
    return cv2.resize(cv2.cvtColor(face, cv2.COLOR_BGR2GRAY), (224, 224))[56:168, 56:168]


class SpeakerModel:
    def __init__(self, path):
        import torch
        from talknet.talkNetModel import talkNetModel
        torch.set_num_threads(1)
        self.torch = torch
        weights = torch.load(path, map_location="cpu", weights_only=True)
        self.model = talkNetModel().eval()
        self.model.load_state_dict({key[6:]: value for key, value in weights.items() if key.startswith("model.")})
        self.head = torch.nn.Linear(256, 2).eval()
        self.head.load_state_dict({key[10:]: value for key, value in weights.items() if key.startswith("lossAV.FC.")})

    def score_track(self, faces, wave):
        from python_speech_features import mfcc
        torch = self.torch
        features = mfcc(wave, 16000, numcep=13, winlen=.025, winstep=.010)
        length = min(len(faces), len(features)//4)
        if length < FPS:
            return None
        with torch.inference_mode():
            audio = self.model.forward_audio_frontend(torch.tensor(features[:length*4], dtype=torch.float32).unsqueeze(0))
            visual = self.model.forward_visual_frontend(torch.tensor(np.array(faces[:length]), dtype=torch.float32).unsqueeze(0))
            audio, visual = self.model.forward_cross_attention(audio, visual)
            logits = self.head(self.model.forward_audio_visual_backend(audio, visual))
            return float(torch.softmax(logits, dim=-1)[:, 1].mean())


from framing_policy import link_face_tracks, track_box_at, frame_track_windows


def analyze(input_path, source_start, duration, face_model, speaker_model, directory):
    normalized = str(Path(directory) / "framing-input.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-i", input_path, "-vf", "fps=25,scale=640:-2",
                    "-an", "-c:v", "libx264", "-preset", "ultrafast", "-y", normalized], check=True, timeout=300)
    # Detect source edits before speaker windows so a window never straddles a cut.
    cuts_result = subprocess.run(["ffmpeg", "-hide_banner", "-i", normalized,
        "-vf", "select='gt(scene,0.3)',showinfo", "-an", "-f", "null", "-"],
        capture_output=True, text=True, check=True, timeout=300)
    cuts = sorted(set(round(float(t)*FPS) for t in re.findall(r"pts_time:([0-9.]+)", cuts_result.stderr)))
    audio_result = subprocess.run(["ffmpeg", "-v", "error", "-i", input_path, "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True, timeout=120)
    audio = np.frombuffer(audio_result.stdout, dtype=np.int16) if audio_result.returncode == 0 else np.array([], dtype=np.int16)
    detector = vision.FaceDetector.create_from_options(vision.FaceDetectorOptions(
        base_options=python.BaseOptions(model_asset_path=face_model), min_detection_confidence=.55))
    video = cv2.VideoCapture(normalized)
    model = None
    points = []
    frame_offset = 0
    diagnostics = []
    try:
        while frame_offset / FPS * 1000 < duration:
            next_cut = next((cut for cut in cuts if cut > frame_offset), round(duration/40))
            # Retain only small grayscale face crops, not full-shot RGB frames.
            rows = []
            shot_start = frame_offset
            while frame_offset < next_cut:
                ok, frame = video.read()
                if not ok:
                    break
                if (frame_offset-shot_start) % DETECT_EVERY == 0:
                    result = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)))
                    rows.append([[d.bounding_box.origin_x, d.bounding_box.origin_y, d.bounding_box.width, d.bounding_box.height] for d in result.detections])
                frame_offset += 1
            if frame_offset == shot_start:
                break
            dimensions = (frame.shape[1], frame.shape[0])
            tracks = link_face_tracks(rows)
            shot_length = frame_offset-shot_start
            video.set(cv2.CAP_PROP_POS_FRAMES, shot_start)
            windows = []
            for offset in range(0, shot_length, WINDOW_FRAMES):
                length = min(WINDOW_FRAMES, shot_length-offset)
                frames = []
                for _ in range(length):
                    ok, frame = video.read()
                    if not ok:
                        raise RuntimeError("shot_reread_failed")
                    frames.append(frame)
                entries = []
                for track in tracks:
                    boxes = [track_box_at(track, i) for i in range(offset, offset+length)]
                    seen = [box for box in boxes if box is not None]
                    if not seen:
                        continue
                    # Score the longest contiguous observed/interpolated interval.
                    runs, begin = [], None
                    for i, box in enumerate([*boxes, None]):
                        if box is not None and begin is None:
                            begin = i
                        elif box is None and begin is not None:
                            runs.append((begin, i)); begin = None
                    begin, end = max(runs, key=lambda r: r[1]-r[0])
                    wave = audio[(shot_start+offset+begin)*640:(shot_start+offset+end)*640]
                    score = None
                    if end-begin >= FPS and len(wave) >= 16000 and np.sqrt(np.mean(wave.astype(float)**2)) > 80:
                        if model is None:
                            model = SpeakerModel(speaker_model)
                        # Smooth detector jitter before presenting mouth motion to TalkNet.
                        smoothed = [np.median(np.array(boxes[max(begin, i-2):min(end, i+3)]), axis=0) for i in range(begin, end)]
                        faces = [face_crop(frames[i], box) for i, box in zip(range(begin, end), smoothed)]
                        score = model.score_track(faces, wave)
                    entries.append({"id": track["id"], "score": score, "boxes": seen})
                windows.append({"sourceMs": source_start+(shot_start+offset)*40, "tracks": entries})
            points.extend(frame_track_windows(windows, *dimensions))
            if os.environ.get("SCRIBIX_FRAMING_DIAGNOSTICS") == "1":
                diagnostics.extend({"sourceMs": w["sourceMs"], "tracks": [{"id": t["id"], "score": t["score"], "samples": len(t["boxes"]), "centerX": float(np.mean([b[0]+b[2]/2 for b in t["boxes"]]))} for t in w["tracks"]]} for w in windows)
        if diagnostics:
            Path(directory, "tracking-diagnostics.json").write_text(json.dumps(diagnostics))
    finally:
        video.release()
        detector.close()
    if not points:
        raise RuntimeError("no_frames")
    return {"schemaVersion": 1, "analyzer": "mediapipe-talknet-v4", "sourceStartMs": source_start,
            "sourceEndMs": source_start + duration, "points": points}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--source-start", type=int, required=True)
    parser.add_argument("--duration", type=int, required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--face-model", default="/opt/scribix-models/blaze_face_full_range_v1.tflite")
    parser.add_argument("--speaker-model", default="/opt/scribix-models/talknet.model")
    args = parser.parse_args()
    plan = analyze(args.input, args.source_start, args.duration, args.face_model, args.speaker_model, str(Path(args.output).parent))
    Path(args.output).write_text(json.dumps(plan))
