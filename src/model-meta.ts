import type { SonioxTranscriptionProviderOptions } from './audio/transcription-provider-options'

/**
 * Model metadata interface for documentation and type inference
 */
interface ModelMeta {
  name: string
  supports: {
    input: Array<'text' | 'image' | 'audio' | 'video' | 'document'>
    output: Array<'text' | 'image' | 'audio' | 'video'>
  }
  pricing?: {
    input?: {
      normal: number
      cached?: number
    }
    output?: {
      normal: number
    }
  }
}

const STT_ASYNC_V3 = {
  name: 'stt-async-v3',
  supports: {
    input: ['audio'],
    output: ['text'],
  },
} as const satisfies ModelMeta

export const SONIOX_TRANSCRIPTION_MODELS = [STT_ASYNC_V3.name] as const

export type SonioxTranscriptionModelProviderOptionsByName = {
  [STT_ASYNC_V3.name]: SonioxTranscriptionProviderOptions
}

export type SonioxModelInputModalitiesByName = {
  [STT_ASYNC_V3.name]: typeof STT_ASYNC_V3.supports.input
}
