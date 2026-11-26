import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const heroApe = path.resolve(
  "C:/Users/giano/.cursor/projects/c-Users-giano-desktop-NFTs/assets/hero-ape.jpg",
);

export default defineConfig({
  plugins: [tanstackRouter(), react(), tailwindcss()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@hero-ape": heroApe,
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname), path.dirname(heroApe)],
    },
  },
});
