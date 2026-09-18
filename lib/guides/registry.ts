// Routes, ordering and media are shared across languages.
export const GUIDE_REGISTRY = [
  {
    "key": "checklist",
    "slug": "podcast-clip-checklist",
    "published": "2026-09-18",
    "sections": [
      {
        "id": "the-listener-test"
      },
      {
        "id": "keep-the-answer"
      },
      {
        "id": "protect-the-meaning"
      },
      {
        "id": "choose-a-set"
      },
      {
        "id": "check-the-picture"
      },
      {
        "id": "read-the-captions"
      },
      {
        "id": "open-the-export"
      }
    ]
  },
  {
    "key": "tutorial",
    "slug": "how-to-clip-podcasts-for-tiktok",
    "published": "2026-09-18",
    "draft": false,
    "walkthrough": {
      "src": "/media/guides/podcast-tiktok/walkthrough.mp4",
      "poster": "/media/guides/podcast-tiktok/walkthrough-poster.jpg"
    },
    "sections": [
      {
        "id": "step-1"
      },
      {
        "id": "step-2"
      },
      {
        "id": "step-3",
        "image": {
          "src": "/media/guides/podcast-tiktok/candidates.jpg",
          "width": 1300,
          "height": 810
        }
      },
      {
        "id": "step-4",
        "image": {
          "src": "/media/guides/podcast-tiktok/content.jpg",
          "width": 1280,
          "height": 640
        }
      },
      {
        "id": "step-5",
        "image": {
          "src": "/media/guides/podcast-tiktok/framing.jpg",
          "width": 1280,
          "height": 665
        }
      },
      {
        "id": "step-6",
        "image": {
          "src": "/media/guides/podcast-tiktok/captions.jpg",
          "width": 1280,
          "height": 665
        }
      },
      {
        "id": "step-7",
        "video": {
          "src": "/media/guides/podcast-tiktok/export.mp4",
          "poster": "/media/guides/podcast-tiktok/export-poster.jpg",
          "portrait": true
        }
      },
      {
        "id": "step-8"
      }
    ]
  }
] as const;
