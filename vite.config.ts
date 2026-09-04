import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    exclude: [...configDefaults.exclude, '**/.worktrees/**', 'scripts/**/*.test.mjs'],
  },
})
