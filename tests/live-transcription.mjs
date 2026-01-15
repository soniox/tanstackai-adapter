import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const apiKey = process.env.SONIOX_API_KEY
if (!apiKey) {
  console.error('SONIOX_API_KEY is required to run this test.')
  process.exit(1)
}

const aiDistUrl = new URL('../node_modules/@tanstack/ai/dist/esm/index.js', import.meta.url)
const sonioxDistUrl = new URL('../dist/esm/index.js', import.meta.url)

const aiDistPath = fileURLToPath(aiDistUrl)
const sonioxDistPath = fileURLToPath(sonioxDistUrl)

if (!fs.existsSync(aiDistPath) || !fs.existsSync(sonioxDistPath)) {
  console.error('Build artifacts not found. Run this first:')
  console.error('  pnpm build')
  process.exit(1)
}

const { generateTranscription } = await import(aiDistUrl.href)
const { sonioxTranscription } = await import(sonioxDistUrl.href)

const audioPath =
  process.argv[2] ??
  './tests/fixtures/test-audio.mp3'

const audio = fs.readFileSync(audioPath)

const result = await generateTranscription({
  adapter: sonioxTranscription('stt-async-v3'),
  audio,
  modelOptions: {
    enableLanguageIdentification: true,
  },
})

console.log(JSON.stringify(result, null, 2))
