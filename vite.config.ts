import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // MP-1.6: Vendor ayrimi — react cekirdegi, animasyon/ui ve grafik
        // kutuphaneleri ayri chunk'larda tutulur. recharts ve html5-qrcode
        // zaten sadece lazy bilesenler tarafindan importlandiklari icin
        // kendi dinamik chunk'larina dusmektedir.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) {
            return undefined;
          }
          if (id.includes("recharts") || id.includes("d3-") || id.includes("victory-vendor")) {
            return "vendor-recharts";
          }
          if (id.includes("html5-qrcode")) {
            return "vendor-qr";
          }
          if (id.includes("motion") || id.includes("framer-motion")) {
            return "vendor-motion";
          }
          if (id.includes("lucide-react")) {
            return "vendor-icons";
          }
          // React cekirdegi: genis "react" eslesmesi (react-dom, react-is,
          // use-sync-external-store...) vendor-ui ile dairesel bag yaratiyor;
          // ayrica path.sinclair, use-sync-external-store ve tslib gibi
          // paylasilan kucuk paketler react chunk'inda tutuluyor.
          const reactCore = ["/react/", "/react-dom/", "/scheduler/", "/react-is/"];
          if (reactCore.some((pattern) => id.includes(pattern))) {
            return "vendor-react";
          }
          return "vendor-ui";
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    watch: {
      ignored: [
        "**/.local-mongo/**",
        "**/.runtime-logs/**",
        "**/uploads/**",
        "**/qr-codes/**",
      ],
    },
    hmr: process.env.DISABLE_HMR !== "true",
  },
});
