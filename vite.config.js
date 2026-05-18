import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Docker içinden dışarıya port fırlatırken (0.0.0.0) dinlemesi için zorunlu
    allowedHosts: [
      'chat.mazlumaydemir.online' // Tarayıcıdaki hata veren domaini güvenli listeye ekliyoruz
    ]
  }
})