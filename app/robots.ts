import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Dashboard uses auth redirects and noindex; crawlers must be able to read them.
          "/admin",
          "/*/admin",
          "/api/",
          "/extension-login",
          "/*/extension-login",
        ],
      },
    ],
    sitemap: "https://scribix.io/sitemap.xml",
  };
}
