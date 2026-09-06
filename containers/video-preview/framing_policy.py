"""Geometry-only speaking-subject framing policy; no ML dependencies."""
import math
import statistics


def select_crop(observations, scores, width, height):
    if not observations or len(observations[0]) not in (1, 2):
        return None
    count = len(observations[0])
    if any(len(row) != count for row in observations):
        return None
    if len(scores) != count or not all(math.isfinite(v) for v in scores) or max(scores) < .8:
        return None
    target = max(range(count), key=lambda i: scores[i])
    if count == 2 and scores[target] - scores[1-target] < .25:
        return None
    for i in range(count):
        median = statistics.median(row[i][0] for row in observations)
        if any(abs(row[i][0] - median) > width * .07 for row in observations):
            return None
    boxes = [row[target] for row in observations]
    if any(not all(math.isfinite(v) for v in b) or b[2] <= 0 or b[3] <= 0 for b in boxes):
        return None
    return crop_for_boxes(boxes, width, height)


def crop_for_boxes(boxes, width, height):
    # Union over the entire shot, expanded beyond the detector's face rectangle
    # for hair, shoulders and breathing room. Never promise pixels outside source.
    left = max(0, min(x - w*.6 for x, y, w, h in boxes))
    right = min(width, max(x + w*1.6 for x, y, w, h in boxes))
    top = max(0, min(y - h*.65 for x, y, w, h in boxes))
    bottom = min(height, max(y + h*2.5 for x, y, w, h in boxes))
    if right <= left or bottom <= top:
        return None
    fill_scale = max(1080/width, 1920/height)
    fit_zoom = min(1080/width, 1920/height) / fill_scale
    zoom = min(1., 1080/((right-left)*fill_scale), 1920/((bottom-top)*fill_scale))
    # Quantize downward, not upward: steadier windows without cutting safety bounds.
    zoom = max(fit_zoom, math.floor(zoom*20)/20)
    def alignment(low, high, extent, target_size):
        window = target_size / (fill_scale * zoom)
        if window >= extent:
            return .5
        offset = (low+high-window)/2
        offset = max(0., min(extent-window, offset))
        # Containment takes precedence over centering.
        offset = max(max(0., high-window), min(min(low, extent-window), offset))
        return max(0., min(1., offset/(extent-window)))
    return {"x": round(alignment(left, right, width, 1080), 5),
            "y": round(alignment(top, bottom, height, 1920), 5), "zoom": round(zoom, 5)}


def stabilize_shot(windows, width, height):
    """Offline shot framing: stable geometry, with confirmed speaker handoffs.

    Face slots are left-to-right within a shot, never carried across a cut.
    A lone visible face can be framed even during a listener reaction shot.
    """
    expected_count = max((len(row) for w in windows for row in w["observations"]), default=0)

    def target(window):
        rows, scores = window["observations"], window["scores"]
        if not rows or not rows[0] or any(len(r) != len(rows[0]) for r in rows):
            return None
        count = len(rows[0])
        if count != expected_count:
            return None
        if count == 1:
            return (1, 0)
        if count != 2 or len(scores) != 2 or not all(math.isfinite(s) for s in scores):
            return None
        best = max(range(2), key=lambda i: scores[i])
        if scores[best] < .8 or scores[best] - scores[1-best] < .25:
            return None
        return (2, best)

    targets = [target(w) for w in windows]
    current = next((t for t in targets if t is not None), None)
    groups, start = [], 0
    for i, t in enumerate(targets):
        # Require two consecutive windows before switching a known subject.
        if t is not None and current is not None and t != current and i+1 < len(targets) and targets[i+1] == t:
            groups.append((start, i, current))
            start, current = i, t
    groups.append((start, len(windows), current))
    points = []
    for start, end, selected in groups:
        boxes = []
        if selected:
            count, index = selected
            for window in windows[start:end]:
                for row in window["observations"]:
                    if len(row) == count:
                        b = row[index]
                        if all(math.isfinite(v) for v in b) and b[2] > 0 and b[3] > 0:
                            boxes.append(b)
        crop = crop_for_boxes(boxes, width, height) if boxes else None
        points.append({"sourceMs": windows[start]["sourceMs"],
                       "framingMode": "fill" if crop else "fit",
                       "crop": crop or {"x": .5, "y": .5, "zoom": 1}})
    return points


def face_iou(a, b):
    intersection = max(0, min(a[0]+a[2], b[0]+b[2])-max(a[0], b[0])) * max(0, min(a[1]+a[3], b[1]+b[3])-max(a[1], b[1]))
    return intersection / max(1, a[2]*a[3]+b[2]*b[3]-intersection)


def link_face_tracks(rows, step=5, max_gap=25):
    """Associate geometry within one shot; tolerate one second of missed faces.

    Ambiguous matches end a track instead of assigning another person's identity.
    """
    tracks = []
    for sample, boxes in enumerate(rows):
        frame = sample*step
        candidates = []
        for ti, track in enumerate(tracks):
            previous, box = track["samples"][-1]
            if frame-previous <= max_gap:
                for bi, other in enumerate(boxes):
                    overlap = face_iou(box, other)
                    if overlap >= .3:
                        candidates.append((overlap, ti, bi))
        used_tracks, used_boxes = set(), set()
        for score, ti, bi in sorted(candidates, reverse=True):
            if ti in used_tracks or bi in used_boxes:
                continue
            if any((oti == ti or obi == bi) and (oti, obi) != (ti, bi) and abs(score-other) < .1
                   for other, oti, obi in candidates):
                continue
            tracks[ti]["samples"].append((frame, boxes[bi]))
            used_tracks.add(ti)
            used_boxes.add(bi)
        for bi, box in enumerate(boxes):
            if bi not in used_boxes:
                tracks.append({"id": len(tracks), "samples": [(frame, box)]})
    return [track for track in tracks if len(track["samples"]) >= 3]


def track_box_at(track, frame, max_gap=25):
    samples = track["samples"]
    if frame < samples[0][0] or frame > samples[-1][0]+4:
        return None
    for i, (at, box) in enumerate(samples):
        if at >= frame:
            if at == frame:
                return box
            previous, before = samples[i-1]
            if at-previous > max_gap:
                return None
            t = (frame-previous)/(at-previous)
            return [a+(b-a)*t for a, b in zip(before, box)]
    return samples[-1][1]


def frame_track_windows(windows, width, height):
    """Choose tracked subjects with independent audiovisual evidence, then lock crop."""
    def winner(window):
        ranked = sorted((t for t in window["tracks"] if t["score"] is not None), key=lambda t: t["score"], reverse=True)
        if not ranked or ranked[0]["score"] < .8:
            return None
        if len(ranked) > 1 and ranked[0]["score"]-ranked[1]["score"] < .25:
            return None
        return ranked[0]["id"]

    votes = [winner(w) for w in windows]
    # At least two windows of evidence before backfilling an uncertain opening.
    confirmed = [t for t in votes if t is not None and votes.count(t) >= 2]
    visible_ids = {t["id"] for w in windows for t in w["tracks"]}
    current = confirmed[0] if confirmed else (next(iter(visible_ids)) if len(visible_ids) == 1 else None)
    groups, start = [], 0
    for i, vote in enumerate(votes):
        if vote is not None and vote != current and i+1 < len(votes) and votes[i+1] == vote:
            groups.append((start, i, current))
            start, current = i, vote
    groups.append((start, len(windows), current))
    points = []
    for start, end, selected in groups:
        if start == end:
            continue
        boxes = [box for w in windows[start:end] for t in w["tracks"] if t["id"] == selected for box in t["boxes"]]
        crop = crop_for_boxes(boxes, width, height) if boxes else None
        # Never backfill a crop into a window where its subject was not observed.
        for i in range(start, end):
            present = any(t["id"] == selected and t["boxes"] for t in windows[i]["tracks"])
            point = {"sourceMs": windows[i]["sourceMs"], "framingMode": "fill" if crop and present else "fit",
                     "crop": crop if crop and present else {"x": .5, "y": .5, "zoom": 1}}
            if not points or (points[-1]["framingMode"], points[-1]["crop"]) != (point["framingMode"], point["crop"]):
                points.append(point)
    return points
