FROM node:22.15.0-bookworm-slim@sha256:557e52a0fcb928ee113df7e1fb5d4f60c1341dbda53f55e3d815ca10807efdce

ARG FFMPEG_VERSION="7:5.1.9-0+deb12u1"
# 1.x Linux wheels abort with SIGILL under local AMD64 emulation without AVX.
ARG MEDIAPIPE_VERSION="0.10.21"
ARG FACE_MODEL_URL="https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_full_range/float16/1/blaze_face_full_range.tflite"
ARG FACE_MODEL_SHA256="3698b18f063835bc609069ef052228fbe86d9c9a6dc8dcb7c7c2d69aed2b181b"

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    ffmpeg="${FFMPEG_VERSION}" \
    libegl1 \
    libgles2 \
    libgl1 \
    libglib2.0-0 \
    python3 \
    python3-venv \
  && rm -rf /var/lib/apt/lists/* \
  && ffmpeg -hide_banner -encoders 2>/dev/null | grep -q libx264 \
  && ffmpeg -hide_banner -filters 2>/dev/null | grep -q subtitles

RUN python3 -m venv /opt/scribix-venv \
  && /opt/scribix-venv/bin/pip install --no-cache-dir --upgrade pip \
  && /opt/scribix-venv/bin/pip install --no-cache-dir "mediapipe==${MEDIAPIPE_VERSION}" "jax==0.4.30" "jaxlib==0.4.30" "numpy==1.26.4" "opencv-contrib-python==4.10.0.84" \
  && /opt/scribix-venv/bin/python -c "from mediapipe.tasks.python import vision; assert vision.FaceDetector"

RUN mkdir -p /opt/scribix-models \
  && curl --fail --location --silent --show-error "${FACE_MODEL_URL}" \
    --output /opt/scribix-models/blaze_face_full_range_v1.tflite \
  && echo "${FACE_MODEL_SHA256}  /opt/scribix-models/blaze_face_full_range_v1.tflite" | sha256sum --check \
  && chmod 0444 /opt/scribix-models/blaze_face_full_range_v1.tflite

# CPU-only active-speaker model; weights are pinned and verified at build time.
RUN /opt/scribix-venv/bin/pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu "torch==2.6.0" \
  && /opt/scribix-venv/bin/pip install --no-cache-dir "numpy==1.26.4" "opencv-contrib-python==4.10.0.84" "scipy==1.14.1" "python_speech_features==0.6" "gdown==5.2.0" \
  && /opt/scribix-venv/bin/python -m gdown 1AbN9fCf9IexMxEKXLQY2KYBlb-IhSEea -O /opt/scribix-models/talknet.model \
  && echo "d985ddd07dca08864a28337726f5b7d91b6426bebc7327f0e9b21cf9ff1cc937  /opt/scribix-models/talknet.model" | sha256sum --check \
  && chmod 0444 /opt/scribix-models/talknet.model

WORKDIR /app
COPY --chown=node:node preview-render.mjs final-render.mjs title-layout.mjs title-font-metrics.mjs poc-reframe.mjs poc-reframe.py worker.mjs analyze-framing.mjs speaker-framing.py ./
COPY --chown=node:node talknet ./talknet
COPY --chown=node:node fonts ./fonts

ENV PATH="/opt/scribix-venv/bin:${PATH}"

# Apply distribution security updates and remove package managers unused at runtime.
# MediaPipe 0.10.21 retains the full-range graph needed by speaker tracking.
# Its Python protobuf gencode is compatible with the patched 5.x runtime:
# https://protobuf.dev/support/cross-version-runtime-guarantee/#python-specific-guarantees
# Install the runtime explicitly after MediaPipe's conservative protobuf<5 resolver pin.
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y \
  && rm -rf /var/lib/apt/lists/* /usr/local/lib/node_modules /opt/yarn-* \
  && /opt/scribix-venv/bin/pip install --no-cache-dir --no-deps "protobuf==5.29.6" "msgpack==1.2.1" \
  && rm -rf /usr/share/python-wheels /usr/lib/python3/dist-packages/setuptools* /usr/lib/python3/dist-packages/pkg_resources /usr/lib/python3/dist-packages/pip* \
    /opt/scribix-venv/lib/python3.11/site-packages/pip* /opt/scribix-venv/lib/python3.11/site-packages/setuptools* /opt/scribix-venv/lib/python3.11/site-packages/pkg_resources /opt/scribix-venv/lib/python3.11/site-packages/wheel*

# Keep graph text serialization compatible with MediaPipe's bundled C++ protobuf.
ENV PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION=python

USER node
EXPOSE 8080
ENTRYPOINT ["node", "/app/worker.mjs"]

COPY framing_policy.py /app/framing_policy.py

# Exercise the real Node -> Python process boundary, not just a Python import.
# PID 1 signal behavior can conceal native model startup failures in ad-hoc tests.
RUN node -e 'const {spawnSync}=require("node:child_process"); const result=spawnSync("python3",["-c","import mediapipe as mp; import numpy as np; detector=mp.solutions.face_detection.FaceDetection(model_selection=1); detector.process(np.zeros((360,640,3),dtype=np.uint8)); detector.close()"],{stdio:"inherit"}); if(result.status!==0) process.exit(1);'
