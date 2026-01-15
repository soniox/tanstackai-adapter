export interface SonioxContextEntry {
  key: string
  value: string
}

export interface SonioxTranslationTerm {
  source: string
  target: string
}

export interface SonioxContext {
  general?: Array<SonioxContextEntry> | null
  text?: string | null
  terms?: Array<string> | null
  translationTerms?: Array<SonioxTranslationTerm> | null
}

export type SonioxTranslation =
  | {
      type: 'one_way'
      targetLanguage: string
    }
  | {
      type: 'two_way'
      languageA: string
      languageB: string
    }

/**
 * Provider-specific options for Soniox Transcription
 */
export interface SonioxTranscriptionProviderOptions {
  /** Language hints to improve recognition. */
  languageHints?: Array<string>
  /** When true, the model will rely more on language hints. */
  languageHintsStrict?: boolean
  /** Whether to enable automatic language identification. */
  enableLanguageIdentification?: boolean
  /** Whether to enable speaker diarization. */
  enableSpeakerDiarization?: boolean
  /** Additional transcription context to improve accuracy. */
  context?: string | SonioxContext
  /** Optional client-defined reference ID for the transcription. */
  clientReferenceId?: string
  /** Webhook URL for transcription completion notifications. */
  webhookUrl?: string
  /** Webhook authentication header name. */
  webhookAuthHeaderName?: string
  /** Webhook authentication header value. */
  webhookAuthHeaderValue?: string
  /** Translation configuration for the transcription. */
  translation?: SonioxTranslation
}
