import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('common/litellm.ts: LiteLLM provider registration', () => {
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of ['LITELLM_API_KEY', 'LITELLM_BASE_URL']) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
    vi.resetModules()
  })

  afterEach(() => {
    for (const key of ['LITELLM_API_KEY', 'LITELLM_BASE_URL']) {
      if (saved[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = saved[key]
      }
    }
    vi.restoreAllMocks()
  })

  it('does not call registerProvider when LITELLM_API_KEY is unset', async () => {
    const mockRegister = vi.fn()
    vi.doMock('@flue/runtime', () => ({ registerProvider: mockRegister }))

    await import('../src/common/litellm')

    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('registers with openai-completions API when key is set', async () => {
    const mockRegister = vi.fn()
    vi.doMock('@flue/runtime', () => ({ registerProvider: mockRegister }))

    process.env.LITELLM_API_KEY = 'sk-test-key'
    process.env.LITELLM_BASE_URL = 'https://litellm.example.com'

    await import('../src/common/litellm')

    expect(mockRegister).toHaveBeenCalledWith('litellm', {
      api: 'openai-completions',
      baseUrl: 'https://litellm.example.com/v1',
      apiKey: 'sk-test-key',
    })
  })

  it('defaults LITELLM_BASE_URL to localhost:4000', async () => {
    const mockRegister = vi.fn()
    vi.doMock('@flue/runtime', () => ({ registerProvider: mockRegister }))

    process.env.LITELLM_API_KEY = 'sk-test-key'
    delete process.env.LITELLM_BASE_URL

    await import('../src/common/litellm')

    expect(mockRegister).toHaveBeenCalledWith('litellm', {
      api: 'openai-completions',
      baseUrl: 'http://localhost:4000/v1',
      apiKey: 'sk-test-key',
    })
  })

  it('strips trailing slashes from base URL', async () => {
    const mockRegister = vi.fn()
    vi.doMock('@flue/runtime', () => ({ registerProvider: mockRegister }))

    process.env.LITELLM_API_KEY = 'sk-test-key'
    process.env.LITELLM_BASE_URL = 'https://litellm.example.com/'

    await import('../src/common/litellm')

    expect(mockRegister).toHaveBeenCalledWith('litellm', {
      api: 'openai-completions',
      baseUrl: 'https://litellm.example.com/v1',
      apiKey: 'sk-test-key',
    })
  })

  it('does not double /v1 when user includes it in base URL', async () => {
    const mockRegister = vi.fn()
    vi.doMock('@flue/runtime', () => ({ registerProvider: mockRegister }))

    process.env.LITELLM_API_KEY = 'sk-test-key'
    process.env.LITELLM_BASE_URL = 'https://litellm.example.com/v1'

    await import('../src/common/litellm')

    expect(mockRegister).toHaveBeenCalledWith('litellm', {
      api: 'openai-completions',
      baseUrl: 'https://litellm.example.com/v1',
      apiKey: 'sk-test-key',
    })
  })

  it('handles /v1/ with trailing slash', async () => {
    const mockRegister = vi.fn()
    vi.doMock('@flue/runtime', () => ({ registerProvider: mockRegister }))

    process.env.LITELLM_API_KEY = 'sk-test-key'
    process.env.LITELLM_BASE_URL = 'https://litellm.example.com/v1/'

    await import('../src/common/litellm')

    expect(mockRegister).toHaveBeenCalledWith('litellm', {
      api: 'openai-completions',
      baseUrl: 'https://litellm.example.com/v1',
      apiKey: 'sk-test-key',
    })
  })

  it('does not register when API key is empty string', async () => {
    const mockRegister = vi.fn()
    vi.doMock('@flue/runtime', () => ({ registerProvider: mockRegister }))

    process.env.LITELLM_API_KEY = ''

    await import('../src/common/litellm')

    expect(mockRegister).not.toHaveBeenCalled()
  })
})
