import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SonioxTranscriptionAdapter } from '../src/adapters/transcription'

const createAdapter = () =>
  new SonioxTranscriptionAdapter(
    {
      apiKey: 'test-key',
      baseUrl: 'https://api.soniox.com',
      pollingIntervalMs: 1,
    },
    'stt-async-v3',
  )

const ensureFilePolyfill = () => {
  if (typeof File !== 'undefined') return

  class FilePolyfill extends Blob {
    name: string
    lastModified: number

    constructor(
      parts: BlobPart[],
      name: string,
      options?: FilePropertyBag,
    ) {
      super(parts, options)
      this.name = name
      this.lastModified = options?.lastModified ?? Date.now()
    }
  }

  // eslint-disable-next-line no-global-assign
  ;(globalThis as typeof globalThis & { File: typeof FilePolyfill }).File =
    FilePolyfill
}

describe('Soniox transcription adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    ensureFilePolyfill()
  })

  it('maps async transcription flow into TranscriptionResult', async () => {
    let statusCalls = 0

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = init?.method ?? 'GET'

      if (url.endsWith('/v1/files') && method === 'POST') {
        return new Response(JSON.stringify({ id: 'file-1' }), { status: 200 })
      }

      if (url.endsWith('/v1/transcriptions') && method === 'POST') {
        return new Response(JSON.stringify({ id: 'tr-1' }), { status: 200 })
      }

      if (url.endsWith('/v1/transcriptions/tr-1') && method === 'GET') {
        statusCalls += 1
        const payload =
          statusCalls < 2
            ? { id: 'tr-1', status: 'processing' }
            : { id: 'tr-1', status: 'completed', audio_duration_ms: 1234 }
        return new Response(JSON.stringify(payload), { status: 200 })
      }

      if (
        url.endsWith('/v1/transcriptions/tr-1/transcript') &&
        method === 'GET'
      ) {
        return new Response(
          JSON.stringify({
            id: 'tr-1',
            text: 'hello world',
            tokens: [
              {
                text: 'hello',
                start_ms: 0,
                end_ms: 500,
                confidence: 0.9,
                speaker: 1,
                language: 'en',
              },
              {
                text: 'world',
                start_ms: 500,
                end_ms: 1000,
                confidence: 0.8,
                speaker: 1,
                language: 'en',
              },
            ],
          }),
          { status: 200 },
        )
      }

      if (method === 'DELETE') {
        return new Response('', { status: 204 })
      }

      return new Response('not found', { status: 404 })
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as typeof fetch

    const adapter = createAdapter()
    const result = await adapter.transcribe({
      model: 'stt-async-v3',
      audio: new ArrayBuffer(4),
      language: 'en',
      modelOptions: {
        enableLanguageIdentification: true,
      },
    })

    expect(result.text).toBe('hello world')
    expect(result.language).toBe('en')
    expect(result.duration).toBeCloseTo(1.234)
    expect(result.segments?.length).toBe(2)
    expect(result.segments?.[0]).toMatchObject({
      text: 'hello',
      start: 0,
      end: 0.5,
      confidence: 0.9,
      speaker: '1',
    })

    const deleteCalls = fetchMock.mock.calls.filter(
      ([, init]) => init?.method === 'DELETE',
    )
    expect(deleteCalls.length).toBe(2)

    globalThis.fetch = originalFetch
  })
})
