import { BaseTranscriptionAdapter } from '@tanstack/ai/adapters'
import {
  DEFAULT_SONIOX_BASE_URL,
  generateId,
  getSonioxApiKeyFromEnv,
} from '../utils'
import type { SONIOX_TRANSCRIPTION_MODELS } from '../model-meta'
import type { SonioxTranscriptionProviderOptions } from '../audio/transcription-provider-options'
import type {
  TranscriptionOptions,
  TranscriptionResult,
  TranscriptionSegment,
} from '@tanstack/ai'
import type { TranscriptionAdapterConfig } from '@tanstack/ai/adapters'

interface SonioxTranscriptToken {
  text: string
  start_ms?: number | null
  end_ms?: number | null
  confidence?: number | null
  speaker?: number | string | null
  language?: string | null
  translation_status?: string | null
}

interface SonioxUploadResponse {
  id: string
}

interface SonioxCreateTranscriptionResponse {
  id: string
  status?: string | null
}

interface SonioxTranscriptionStatusResponse {
  id: string
  status: string
  audio_duration_ms?: number | null
  error_message?: string | null
}

interface SonioxTranscriptResponse {
  id: string
  text?: string | null
  tokens?: Array<SonioxTranscriptToken> | null
}

/**
 * Configuration for Soniox Transcription adapter
 */
export interface SonioxTranscriptionConfig extends TranscriptionAdapterConfig {
  pollingIntervalMs?: number
}

/** Model type for Soniox Transcription */
export type SonioxTranscriptionModel =
  (typeof SONIOX_TRANSCRIPTION_MODELS)[number]

/**
 * Soniox Transcription (Speech-to-Text) Adapter
 *
 * Tree-shakeable adapter for Soniox async transcription functionality.
 * Supports stt-async-v3.
 */
export class SonioxTranscriptionAdapter<
  TModel extends SonioxTranscriptionModel,
> extends BaseTranscriptionAdapter<TModel, SonioxTranscriptionProviderOptions> {
  readonly name = 'soniox' as const

  private readonly pollingIntervalMs = 1000
  protected override config: SonioxTranscriptionConfig

  constructor(config: SonioxTranscriptionConfig, model: TModel) {
    super(config, model)
    this.config = config
  }

  async transcribe(
    options: TranscriptionOptions<SonioxTranscriptionProviderOptions>,
  ): Promise<TranscriptionResult> {
    const { model, audio, language, modelOptions } = options

    const file = this.prepareAudioFile(audio)
    const headers = this.buildHeaders()

    let fileId: string | undefined
    let transcriptionId: string | undefined

    try {
      const formData = new FormData()
      formData.append('file', file)

      const uploadResponse = await this.requestJson<SonioxUploadResponse>(
        '/v1/files',
        {
          method: 'POST',
          headers,
          body: formData,
        },
      )

      fileId = uploadResponse.id

      const mapped = this.mapProviderOptions(modelOptions, language)

      const createResponse =
        await this.requestJson<SonioxCreateTranscriptionResponse>(
          '/v1/transcriptions',
          {
            method: 'POST',
            headers: {
              ...headers,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model,
              file_id: fileId,
              language_hints: mapped.languageHints,
              language_hints_strict: mapped.languageHintsStrict,
              enable_language_identification:
                mapped.enableLanguageIdentification,
              enable_speaker_diarization: mapped.enableSpeakerDiarization,
              context: this.mapContext(mapped.context),
              client_reference_id: mapped.clientReferenceId,
              webhook_url: mapped.webhookUrl,
              webhook_auth_header_name: mapped.webhookAuthHeaderName,
              webhook_auth_header_value: mapped.webhookAuthHeaderValue,
              translation: this.mapTranslation(mapped.translation),
            }),
          },
        )

      transcriptionId = createResponse.id

      const statusResponse = await this.pollForCompletion(transcriptionId)

      const transcriptResponse =
        await this.requestJson<SonioxTranscriptResponse>(
          `/v1/transcriptions/${transcriptionId}/transcript`,
          {
            method: 'GET',
            headers,
          },
        )

      const tokens = transcriptResponse.tokens ?? []
      const segments = this.buildSegments(tokens)
      const detectedLanguage = this.getLanguageFromTokens(tokens)

      return {
        id: generateId(this.name),
        model,
        text: transcriptResponse.text ?? '',
        language: detectedLanguage ?? language,
        duration:
          typeof statusResponse.audio_duration_ms === 'number'
            ? statusResponse.audio_duration_ms / 1000
            : undefined,
        segments: segments.length > 0 ? segments : undefined,
      }
    } finally {
      await this.tryDeleteResource(
        transcriptionId ? `/v1/transcriptions/${transcriptionId}` : undefined,
        headers,
      )
      await this.tryDeleteResource(
        fileId ? `/v1/files/${fileId}` : undefined,
        headers,
      )
    }
  }

  private mapProviderOptions(
    options: SonioxTranscriptionProviderOptions | undefined,
    language: string | undefined,
  ): SonioxTranscriptionProviderOptions {
    const languageHints = options?.languageHints
      ? [...options.languageHints]
      : []

    if (language && !languageHints.includes(language)) {
      languageHints.push(language)
    }

    return {
      ...options,
      languageHints: languageHints.length > 0 ? languageHints : undefined,
    }
  }

  private mapContext(context: SonioxTranscriptionProviderOptions['context']) {
    if (!context) return undefined

    if (typeof context === 'string') {
      return context
    }

    return {
      general: context.general ?? undefined,
      text: context.text ?? undefined,
      terms: context.terms ?? undefined,
      translation_terms: context.translationTerms ?? undefined,
    }
  }

  private mapTranslation(
    translation: SonioxTranscriptionProviderOptions['translation'],
  ) {
    if (!translation) return undefined

    if (translation.type === 'one_way') {
      return {
        type: 'one_way',
        target_language: translation.targetLanguage,
      }
    }

    return {
      type: 'two_way',
      language_a: translation.languageA,
      language_b: translation.languageB,
    }
  }

  private buildSegments(
    tokens: Array<SonioxTranscriptToken>,
  ): Array<TranscriptionSegment> {
    return tokens
      .filter(
        (token) =>
          typeof token.start_ms === 'number' &&
          typeof token.end_ms === 'number',
      )
      .map((token, index) => ({
        id: index,
        start: token.start_ms! / 1000,
        end: token.end_ms! / 1000,
        text: token.text,
        confidence: token.confidence ?? undefined,
        speaker:
          token.speaker === null || token.speaker === undefined
            ? undefined
            : String(token.speaker),
      }))
  }

  private getLanguageFromTokens(
    tokens: Array<SonioxTranscriptToken>,
  ): string | undefined {
    if (tokens.length === 0) return undefined

    const counts = new Map<string, number>()
    for (const token of tokens) {
      const lang = token.language ?? undefined
      if (!lang) continue
      counts.set(lang, (counts.get(lang) ?? 0) + 1)
    }

    let bestLanguage: string | undefined
    let bestCount = 0
    for (const [language, count] of counts) {
      if (count > bestCount) {
        bestLanguage = language
        bestCount = count
      }
    }

    return bestLanguage
  }

  private async pollForCompletion(
    transcriptionId: string,
  ): Promise<SonioxTranscriptionStatusResponse> {
    const headers = this.buildHeaders()
    const start = Date.now()
    const timeoutMs = this.config.timeout ?? 3 * 60 * 1000
    const interval = this.config.pollingIntervalMs ?? this.pollingIntervalMs

    for (;;) {
      if (Date.now() - start > timeoutMs) {
        throw new Error('Transcription job polling timed out')
      }

      const statusResponse =
        await this.requestJson<SonioxTranscriptionStatusResponse>(
          `/v1/transcriptions/${transcriptionId}`,
          {
            method: 'GET',
            headers,
          },
        )

      if (statusResponse.status === 'completed') {
        return statusResponse
      }

      if (statusResponse.status === 'error') {
        throw new Error(
          `Transcription failed: ${statusResponse.error_message ?? 'Unknown error'}`,
        )
      }

      await this.delay(interval)
    }
  }

  private async requestJson<T>(path: string, init: RequestInit): Promise<T> {
    const url = new URL(path, this.config.baseUrl ?? DEFAULT_SONIOX_BASE_URL)
    const response = await fetch(url, init)

    if (!response.ok) {
      const text = await this.safeReadText(response)
      throw new Error(
        `Soniox API error (${response.status} ${response.statusText})${
          text ? `: ${text}` : ''
        }`,
      )
    }

    const text = await this.safeReadText(response)
    if (!text) {
      return {} as T
    }

    try {
      return JSON.parse(text) as T
    } catch (error) {
      throw new Error('Failed to parse Soniox response JSON')
    }
  }

  private async safeReadText(response: Response): Promise<string> {
    try {
      return await response.text()
    } catch {
      return ''
    }
  }

  private async tryDeleteResource(
    path: string | undefined,
    headers: Record<string, string>,
  ): Promise<void> {
    if (!path) return

    try {
      await fetch(
        new URL(path, this.config.baseUrl ?? DEFAULT_SONIOX_BASE_URL),
        {
          method: 'DELETE',
          headers,
        },
      )
    } catch {
      // best effort cleanup
    }
  }

  private buildHeaders(): Record<string, string> {
    const apiKey = this.config.apiKey ?? getSonioxApiKeyFromEnv()
    return {
      authorization: `Bearer ${apiKey}`,
      ...this.config.headers,
    }
  }

  private prepareAudioFile(
    audio: string | File | Blob | ArrayBuffer | Uint8Array,
  ): File {
    if (typeof File !== 'undefined' && audio instanceof File) {
      return audio
    }

    if (typeof Blob !== 'undefined' && audio instanceof Blob) {
      const mimeType = audio.type || 'audio/mpeg'
      const extension = mimeType.split('/')[1] || 'mp3'
      return new File([audio], `audio.${extension}`, { type: mimeType })
    }

    if (audio instanceof ArrayBuffer) {
      return new File([new Uint8Array(audio)], 'audio.mp3', {
        type: 'audio/mpeg',
      })
    }

    if (audio instanceof Uint8Array) {
      return new File([audio], 'audio.mp3', { type: 'audio/mpeg' })
    }

    if (typeof audio === 'string') {
      if (audio.startsWith('data:')) {
        const [header, base64Data] = audio.split(',')
        const mimeMatch = header?.match(/data:([^;]+)/)
        const mimeType = mimeMatch?.[1] || 'audio/mpeg'
        const binaryStr = atob(base64Data || '')
        const bytes = new Uint8Array(binaryStr.length)
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i)
        }
        const extension = mimeType.split('/')[1] || 'mp3'
        return new File([bytes], `audio.${extension}`, { type: mimeType })
      }

      const binaryStr = atob(audio)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }
      return new File([bytes], 'audio.mp3', { type: 'audio/mpeg' })
    }

    throw new Error('Invalid audio input type')
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/**
 * Creates a Soniox transcription adapter with explicit API key.
 */
export function createSonioxTranscription<
  TModel extends SonioxTranscriptionModel,
>(
  model: TModel,
  apiKey: string,
  config?: Omit<SonioxTranscriptionConfig, 'apiKey'>,
): SonioxTranscriptionAdapter<TModel> {
  return new SonioxTranscriptionAdapter({ apiKey, ...config }, model)
}

/**
 * Creates a Soniox transcription adapter using environment variables.
 */
export function sonioxTranscription<TModel extends SonioxTranscriptionModel>(
  model: TModel,
  config?: Omit<SonioxTranscriptionConfig, 'apiKey'>,
): SonioxTranscriptionAdapter<TModel> {
  const apiKey = getSonioxApiKeyFromEnv()
  return new SonioxTranscriptionAdapter({ apiKey, ...config }, model)
}
