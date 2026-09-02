import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    globals: true,
    // İlk koşumda mongodb-memory-server mongod indirmesi + koleksiyon
    // oluşturma tek dosyada 5 sn varsayılanı zorlayabiliyor (MP-1.9).
    testTimeout: 15000,
  },
});
