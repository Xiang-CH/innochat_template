import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    build: {
        outDir: "../backend/static",
        emptyOutDir: true,
        sourcemap: true
    },
    server: {
        proxy: {
            "/chat": "http://localhost:5000",
            "/tts": "http://localhost:5000",
            "/stt": "http://localhost:5000",
            "/viseme": "http://localhost:5000",
            "/visemeAudio": "http://localhost:5000",
            "/content": "http://localhost:5000"
        }
    }
});
