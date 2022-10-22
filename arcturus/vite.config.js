import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const fs = require('fs')

const options = {
  key: fs.readFileSync('./arcturusrpg_io.key'),
  cert: fs.readFileSync('./arcturusrpg_io.crt'),
  ca: fs.readFileSync('./arcturusrpg_io.ca-bundle')
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 443,
    host: "arcturusrpg.io",
    https: options
  }
})
