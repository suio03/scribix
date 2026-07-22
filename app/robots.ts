import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/*/dashboard",
          "/admin",
          "/*/admin",
          "/api/",
          "/extension-login",
          "/*/extension-login",
        ],
      },
    ],
    sitemap: "https://scribix.io/sitemap.xml",
    host: "https://scribix.io",
  };
}
