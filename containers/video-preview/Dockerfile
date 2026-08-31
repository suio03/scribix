FROM node:22.15.0-bookworm-slim

ARG FFMPEG_VERSION="7:5.1.9-0+deb12u1"

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg="${FFMPEG_VERSION}" \
  && rm -rf /var/lib/apt/lists/* \
  && ffmpeg -hide_banner -encoders 2>/dev/null | grep -q libx264

WORKDIR /app
COPY --chown=node:node preview-render.mjs worker.mjs ./

USER node
ENTRYPOINT ["node", "/app/worker.mjs"]
