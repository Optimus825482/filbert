import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Filbert — Fındığın Dijital Aklı",
    short_name: "Filbert",
    description: "Fındık tüccarları için saha odaklı ticaret ve ön muhasebe uygulaması",
    lang: "tr",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#052e16",
    theme_color: "#15803d",
    icons: [
      { src: "/all-icons/Android/Icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/all-icons/Android/Icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/all-icons/Android/Icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
