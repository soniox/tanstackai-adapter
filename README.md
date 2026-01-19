# @soniox/tanstack-ai-adapter

[TanStack AI](https://tanstack.com/ai) adapter for Soniox transcription models. This adapter integrates Soniox speech-to-text capabilities with TanStack AI's transcription API.

## Installation

```bash
npm install @soniox/tanstack-ai-adapter
```

## Authentication

Set `SONIOX_API_KEY` in your environment or pass `apiKey` when creating the adapter.
Get your API key from the [Soniox Console](https://console.soniox.com).

## Example

```ts
import { generateTranscription } from '@tanstack/ai'
import { sonioxTranscription } from '@soniox/tanstack-ai-adapter'

const result = await generateTranscription({
  adapter: sonioxTranscription('stt-async-v3'),
  audio: audioFile,
  modelOptions: {
    enableLanguageIdentification: true,
    enableSpeakerDiarization: true,
  },
})

console.log(result.text)
console.log(result.segments) // Timestamped segments with speaker info
```

## Adapter configuration

Use `createSonioxTranscription` to customize the adapter instance:

```ts
import { createSonioxTranscription } from '@soniox/tanstack-ai-adapter'

const adapter = createSonioxTranscription('stt-async-v3', process.env.SONIOX_API_KEY!, {
  baseUrl: 'https://api.soniox.com',
  pollingIntervalMs: 1000,
  timeout: 180000,
  headers: {
    'Custom-Header': 'value',
  },
})
```

Options:
- `apiKey`: override `SONIOX_API_KEY` (required when using `createSonioxTranscription`).
- `baseUrl`: custom API base URL. See list of regional API endpoints [here](https://soniox.com/docs/stt/data-residency#regional-endpoints). Default is `https://api.soniox.com`.
- `headers`: additional request headers.
- `timeout`: transcription timeout in milliseconds. Default is 180000ms (3 minutes).
- `pollingIntervalMs`: transcription polling interval in milliseconds. Default is 1000ms.

## Transcription options

Per-request options are passed via `modelOptions`:

```ts
const result = await generateTranscription({
  adapter: sonioxTranscription('stt-async-v3'),
  audio,
  modelOptions: {
    languageHints: ['en', 'es'],
    enableLanguageIdentification: true,
    enableSpeakerDiarization: true,
    context: {
      terms: ['Soniox', 'TanStack'],
    },
  },
})
```

Available options:
- `languageHints` - Array of ISO language codes to bias recognition
- `languageHintsStrict` - When true, rely more heavily on language hints (note: not supported by all models)
- `enableLanguageIdentification` - Automatically detect spoken language
- `enableSpeakerDiarization` - Identify and separate different speakers
- `context` - Additional context to improve accuracy (see Context section)
- `clientReferenceId` - Optional client-defined reference ID
- `webhookUrl` - Webhook URL for transcription completion notifications
- `webhookAuthHeaderName` - Webhook authentication header name
- `webhookAuthHeaderValue` - Webhook authentication header value
- `translation` - Translation configuration (see Translation section)

Check the [Soniox API reference](https://soniox.com/docs/stt/api-reference/transcriptions/create_transcription) for more details.

## Language hints

Soniox automatically detects and transcribes speech in [**60+ languages**](https://soniox.com/docs/stt/concepts/supported-languages). When you know which languages are likely to appear in your audio, provide `languageHints` to improve accuracy by biasing recognition toward those languages.

Language hints **do not restrict** recognition — they only **bias** the model toward the specified languages, while still allowing other languages to be detected if present.

If you pass the TanStack `language` option, this adapter will merge it into `languageHints` for convenience.

```ts
const result = await generateTranscription({
  adapter: sonioxTranscription('stt-async-v3'),
  audio,
  modelOptions: {
    languageHints: ['en', 'es'], // ISO language codes
  },
})
```

For more details, see the [Soniox language hints documentation](https://soniox.com/docs/stt/concepts/language-hints).

## Context

Provide custom context to improve transcription and translation accuracy. Context helps the model understand your domain, recognize important terms, and apply custom vocabulary.

The `context` object supports four optional sections:

```ts
const result = await generateTranscription({
  adapter: sonioxTranscription('stt-async-v3'),
  audio,
  modelOptions: {
    context: {
      // Structured key-value information (domain, topic, intent, etc.)
      general: [
        { key: 'domain', value: 'Healthcare' },
        { key: 'topic', value: 'Diabetes management consultation' },
        { key: 'doctor', value: 'Dr. Martha Smith' },
      ],
      // Longer free-form background text or related documents
      text: 'The patient has a history of...',
      // Domain-specific or uncommon words
      terms: ['Celebrex', 'Zyrtec', 'Xanax'],
      // Custom translations for ambiguous terms
      translationTerms: [
        { source: 'Mr. Smith', target: 'Sr. Smith' },
        { source: 'MRI', target: 'RM' },
      ],
    },
  },
})
```

For more details, see the [Soniox context documentation](https://soniox.com/docs/stt/concepts/context).

## Translation

Configure translation for your transcriptions:

```ts
const result = await generateTranscription({
  adapter: sonioxTranscription('stt-async-v3'),
  audio,
  modelOptions: {
    translation: {
      type: 'one_way',
      targetLanguage: 'es', // Translate to Spanish
    },
  },
})

// Or for two-way translation:
modelOptions: {
  translation: {
    type: 'two_way',
    languageA: 'en',
    languageB: 'es',
  },
}
```

## Response format

The `generateTranscription` function returns a `TranscriptionResult` object:

```ts
{
  id: string
  model: string
  text: string // Full transcription text
  language?: string // Detected language
  duration?: number // Audio duration in seconds
  segments?: Array<{
    id: number
    start: number // Start time in seconds
    end: number // End time in seconds
    text: string
    confidence?: number // Confidence score (0-1)
    speaker?: string // Speaker identifier (if diarization enabled)
  }>
}
```

## Documentation

- Soniox API docs: https://soniox.com/docs
- TanStack AI docs: https://tanstack.com/ai
