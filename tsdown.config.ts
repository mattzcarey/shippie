import fs from 'node:fs'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  minify: true,
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
    const uiSrcPath = join('./src/ui/ui/dist')
    const uiDistPath = join('./dist/ui-assets')

    if (!existsSync(uiSrcPath)) {
      console.warn('⚠️  UI not built yet!')
      console.warn('   Build it manually: cd src/ui/ui && bun run build')
      console.warn('   The UI command will not work until the UI is built.')
      return
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
    console.log('✓ UI assets copied successfully')
  },
})
