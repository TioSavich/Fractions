const { defineConfig } = require('vite')

module.exports = defineConfig({
  root: './',
  publicDir: 'public',
  base: './',
  server: {
    port: 5173
  }
})