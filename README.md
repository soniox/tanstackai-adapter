# @soniox/tanstack-ai-adapter

Soniox transcription adapter for TanStack AI.

## Installation

```bash
npm install @soniox/tanstack-ai-adapter
```

## Usage

```typescript
import { generateTranscription } from '@tanstack/ai'
import { sonioxTranscription } from '@soniox/tanstack-ai-adapter'

const result = await generateTranscription({
  adapter: sonioxTranscription('stt-async-v3'),
  audio: audioFile,
  language: 'en',
  modelOptions: {
    enableLanguageIdentification: true,
    enableSpeakerDiarization: true,
  },
})

console.log(result.text)
```

## API Key

Set `SONIOX_API_KEY` in your environment, or use the factory with an explicit key:

```typescript
import { createSonioxTranscription } from '@soniox/tanstack-ai-adapter'

const adapter = createSonioxTranscription('stt-async-v3', process.env.SONIOX_API_KEY!)
```
