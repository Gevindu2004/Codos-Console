import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://console.viacodos.com";
  const currentDate = new Date();

  return [
    {
      url: `${baseUrl}/`,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/console`,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/#services`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/#voice-agent`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/#thumbs-up-api`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/#llm-studio`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/#pricing`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/#docs`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];
}

