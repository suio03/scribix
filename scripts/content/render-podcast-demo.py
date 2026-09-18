"""Compose real Scribix captures into a silent website demonstration.

Usage: python3 scripts/content/render-podcast-demo.py ARTIFACT_DIR SOURCE_MP4
Requires FFmpeg with drawtext and Pillow; ARTIFACT_DIR contains captures, Geist.ttf and exported-clip.mp4.
No UI reconstruction, synthetic export or source file copy is performed.
"""
import argparse
import os
import json
from PIL import ImageFont
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("artifacts", type=Path)
parser.add_argument("source", type=Path)
parser.add_argument("--locale", choices=["en", "fr", "es", "it", "ja", "de"], default="en")
parser.add_argument("--font", type=Path)
args = parser.parse_args()
root = args.artifacts.resolve()
font = args.font or root / "Geist.ttf"
output_dir = root if args.locale == "en" else root / args.locale
output_dir.mkdir(exist_ok=True)
copy = json.loads((Path(__file__).resolve().parents[2] / "lib/guides/locales" / f"{args.locale}.json").read_text())["demo"]


def run(argv):
    subprocess.run([os.environ.get("FFMPEG_PATH", "ffmpeg"), "-hide_banner", "-loglevel", "error", "-y", *argv], check=True)


def text(value, name, size, x, y, color="F7F4FF"):
    path = output_dir / (name + ".txt")
    max_width = 525 if x < 100 and y not in (64, 992) else (1000 if x >= 650 else 1600)
    while size > 16 and max(ImageFont.truetype(str(font), size).getlength(line) for line in value.splitlines()) > max_width:
        size -= 1
    path.write_text(value)
    return f"drawtext=fontfile='{font}':textfile='{path}':fontsize={size}:fontcolor=0x{color}:x={x}:y={y}:line_spacing=12"


shots = [
    ("source", args.source.resolve(), 4, None),
    ("select", root / "01-candidates.png", 6, "1300:810:260:175"),
    ("content", root / "02-content-before.png", 6, "1280:640:280:350"),
    ("framing", root / "03-framing.png", 6, "1280:665:280:350"),
    ("captions", root / "04-captions.png", 6, "1280:665:280:350"),
    ("output", root / "exported-clip.mp4", 9, None),
    ("end", None, 4, None),
]

outputs = []
for i, (name, media, duration, crop) in enumerate(shots):
    words = copy["scenes"][i]
    title, description, label = words["title"], words["body"], words["label"]
    inputs = ["-f", "lavfi", "-i", f"color=c=0x100B21:s=1920x1080:r=30:d={duration}"]
    base = "[0:v]drawbox=x=0:y=0:w=1920:h=6:color=0x9568FF:t=fill,drawbox=x=650:y=125:w=1190:h=824:color=0x251A40:t=fill"
    base += "," + text("Scribix", name + "-brand", 40, 86, 64)
    base += "," + text(label, name + "-label", 21, 88, 263, "BCA3FF")
    base += "," + text(title, name + "-title", 57, 84, 330)
    base += "," + text(description, name + "-description", 25, 88, 525, "C4BDD5")
    base += "," + text(copy["footer"], name + "-footer", 18, 88, 992, "A69BB9")
    base += "," + text(f"{i+1:02d} / 07", name + "-counter", 19, 1730, 992, "BCA3FF")
    base += "[base];"
    if media:
        if media.suffix == ".png":
            inputs += ["-loop", "1", "-framerate", "30", "-i", str(media)]
            transform = f"crop={crop},scale=1160:780:force_original_aspect_ratio=decrease,pad=1160:780:(ow-iw)/2:(oh-ih)/2:color=0x19112F"
            transform += f",zoompan=z='1+0.018*on/{duration*30}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1160x780:fps=30"
        else:
            inputs += ["-ss", "1.663" if name == "source" else "34", "-i", str(media)]
            transform = "scale=1160:780:force_original_aspect_ratio=decrease,pad=1160:780:(ow-iw)/2:(oh-ih)/2:color=0x19112F,fps=30"
        graph = base + f"[1:v:0]{transform},setsar=1[media];[base][media]overlay=665:147:shortest=1"
        graph += "," + text(copy["credit"], name + "-credit", 17, 681, 956, "A69BB9")
    else:
        graph = base + "[base]" + text(copy["cta"], name + "-cta", 68, 780, 408)
        graph += "," + text("scribix.io", name + "-url", 36, 785, 525, "FFE15A")
    graph += f",fade=t=in:st=0:d=0.25,fade=t=out:st={duration-0.25}:d=0.25,format=yuv420p[out]"
    out = output_dir / f"scene-{i+1:02d}.mp4"
    run([*inputs, "-filter_complex_threads", "2", "-filter_complex", graph, "-map", "[out]", "-an", "-t", str(duration), "-c:v", "libx264", "-preset", "fast", "-crf", "19", "-threads", "4", str(out)])
    outputs.append(out)
    print(f"Rendered {name}", flush=True)

concat = output_dir / "scenes.txt"
concat.write_text("".join(f"file '{p}'\n" for p in outputs))
run(["-f", "concat", "-safe", "0", "-i", str(concat), "-c", "copy", "-movflags", "+faststart", str(output_dir / "scribix-podcast-demo.mp4")])
run(["-ss", "5", "-i", str(output_dir / "scribix-podcast-demo.mp4"), "-frames:v", "1", str(output_dir / "poster.jpg")])
print(output_dir / "scribix-podcast-demo.mp4")
