import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves a project site from /<repo>/, so production builds are
// mounted there. Dev keeps the root so local URLs stay short.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/le.gume-energy/' : '/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Motion and its tween engine are the bulk of the bundle; keeping them in
    // their own chunk lets the app code and the router cache separately.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/motion') || id.includes('node_modules/lucide-react')) return 'vendor-ui'
          if (id.includes('node_modules/react-markdown') || id.includes('node_modules/remark') || id.includes('node_modules/micromark') || id.includes('node_modules/unified'))
            return 'vendor-markdown'
          if (id.includes('node_modules/react')) return 'vendor-react'
        },
      },
    },
  },
}))
