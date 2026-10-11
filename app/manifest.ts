import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vision Board To Do",
    short_name: "Vision Tasks",
    description: "Projects, tasks, and reminders",
    start_url: "/protected",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
  };
}