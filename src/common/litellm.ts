import { registerProvider } from '@flue/runtime'

function normalizeLitellmBaseUrl(raw: string): string {
  let url = raw.replace(/\/+$/, '')
  if (url.endsWith('/v1')) {
    url = url.slice(0, -3)
  }
  return url + '/v1'
}

const baseUrl = process.env.LITELLM_BASE_URL || 'http://localhost:4000'
const apiKey = process.env.LITELLM_API_KEY

if (apiKey) {
  registerProvider('litellm', {
    api: 'openai-completions',
    baseUrl: normalizeLitellmBaseUrl(baseUrl),
    apiKey,
  })
}
