export interface SonioxClientConfig {
  apiKey: string
  baseUrl?: string
}

export const DEFAULT_SONIOX_BASE_URL = 'https://api.soniox.com'

/**
 * Gets Soniox API key from environment variables.
 * @throws Error if SONIOX_API_KEY is not found
 */
export function getSonioxApiKeyFromEnv(): string {
  const env =
    typeof globalThis !== 'undefined' && (globalThis as any).window?.env
      ? (globalThis as any).window.env
      : typeof process !== 'undefined'
        ? process.env
        : undefined
  const key = env?.SONIOX_API_KEY

  if (!key) {
    throw new Error(
      'SONIOX_API_KEY is required. Please set it in your environment variables or use the factory function with an explicit API key.',
    )
  }

  return key
}

/**
 * Generates a unique ID with a prefix
 */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`
}
