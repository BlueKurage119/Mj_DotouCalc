/// <reference types="vitest/config" />
import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import wasmImport from 'vite-plugin-wasm'

// CJS/ESM の型解決差異を吸収 (実行時は関数がdefaultエクスポートされる)
const wasm = wasmImport as unknown as () => PluginOption

// GitHub Pages ではリポジトリ名がサブパスになる
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/Mj_DotouCalc/' : '/',
  plugins: [react(), wasm()],
  build: {
    // wasm ESM統合が top-level await を使うため
    target: 'esnext',
  },
  test: {
    environment: 'node',
  },
})
