import { registerProvider } from '@flue/runtime'

const baseUrl = process.env.LITELLM_BASE_URL || 'http://localhost:4000'
const apiKey = process.env.LITELLM_API_KEY

if (apiKey) {
  registerProvider('litellm', {
    api: 'openai-completions',
    baseUrl: baseUrl.replace(/\/+$/, '') + '/v1',
    apiKey,
  })
}
