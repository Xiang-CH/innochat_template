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
            "/chat": "http://127.0.0.1:5000",
            "/tts": "http://127.0.0.1:5000",
            "/stt": "http://127.0.0.1:5000",
            "/viseme": "http://127.0.0.1:5000",
            "/visemeAudio": "http://127.0.0.1:5000",
            "/content": "http://127.0.0.1:5000"
        }
    }
});
