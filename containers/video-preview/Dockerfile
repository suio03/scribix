FROM node:22.15.0-bookworm-slim@sha256:557e52a0fcb928ee113df7e1fb5d4f60c1341dbda53f55e3d815ca10807efdce

ARG FFMPEG_VERSION="7:5.1.9-0+deb12u1"
ARG MEDIAPIPE_VERSION="1.0.1"
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
  && /opt/scribix-venv/bin/pip install --no-cache-dir "mediapipe==${MEDIAPIPE_VERSION}" \
  && /opt/scribix-venv/bin/python -c "from mediapipe.tasks.python import vision; assert vision.FaceDetector"

RUN mkdir -p /opt/scribix-models \
  && curl --fail --location --silent --show-error "${FACE_MODEL_URL}" \
    --output /opt/scribix-models/blaze_face_full_range_v1.tflite \
  && echo "${FACE_MODEL_SHA256}  /opt/scribix-models/blaze_face_full_range_v1.tflite" | sha256sum --check \
  && chmod 0444 /opt/scribix-models/blaze_face_full_range_v1.tflite

WORKDIR /app
COPY --chown=node:node preview-render.mjs final-render.mjs poc-reframe.mjs poc-reframe.py worker.mjs ./

ENV PATH="/opt/scribix-venv/bin:${PATH}"

USER node
EXPOSE 8080
ENTRYPOINT ["node", "/app/worker.mjs"]
