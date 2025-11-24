import fs, { existsSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  minify: true,
  treeshake: true,
  shims: true,
  async onSuccess() {
    console.log('Build completed! Running post-build tasks...')

    // Copy templates
    const templates = ['github-pr.yml', 'gitlab-pr.yml', 'azdev-pr.yml']

    for (const template of templates) {
      const content = await fs.promises.readFile(join('./templates', template), 'utf8')
      await fs.promises.writeFile(join('./dist', template), content)
    }
    console.log('✓ Templates copied')

    // Handle React UI assets
    const uiSrcPath = join('./src/ui/web/dist')
    const uiDistPath = join('./dist/ui-assets')

    if (!existsSync(uiSrcPath)) {
      throw new Error('UI assets not found. Please run `bun run build:ui` first.')
    }

    // Copy the built UI assets to dist/ui-assets
    console.log('Copying UI assets to dist/ui-assets...')
    await fs.promises.mkdir(uiDistPath, { recursive: true })

    // Copy all files from ui/dist to dist/ui-assets
    const copyRecursive = async (src: string, dest: string) => {
      const entries = await fs.promises.readdir(src, { withFileTypes: true })

      for (const entry of entries) {
        const srcPath = join(src, entry.name)
        const destPath = join(dest, entry.name)

        if (entry.isDirectory()) {
          await fs.promises.mkdir(destPath, { recursive: true })
          await copyRecursive(srcPath, destPath)
        } else {
          await fs.promises.copyFile(srcPath, destPath)
        }
      }
    }

    await copyRecursive(uiSrcPath, uiDistPath)
  },
})
