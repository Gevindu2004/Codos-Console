import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/private/", "/console/internal/"],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
      },
    ],
    sitemap: "https://console.viacodos.com/sitemap.xml",
  };
}

