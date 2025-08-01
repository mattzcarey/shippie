import type { GenerateTextResult, LanguageModelV1 } from 'ai'
import { accumulateTokenUsage, formatToolUsage } from '../../common/formatting/usage'
import { MCPClientManager } from '../../common/llm/mcp/client'
import { getAllTools } from '../../common/llm/tools'
import type { PlatformProvider } from '../../common/platform/provider'
import { logger } from '../../common/utils/logger'
import type { TokenUsage, ToolCall } from '../types'
import { reviewAgent } from './generate'

export const runAgenticReview = async (
  initialPrompt: string,
  model: LanguageModelV1,
  platformProvider: PlatformProvider,
  maxSteps: number,
  maxRetries = 3
): Promise<string> => {
  logger.info(`Running agentic review (max retries: ${maxRetries})...`)

  const clients = new MCPClientManager()
  await clients.loadConfig()
  await clients.startClients()

  const tools = await getAllTools({
    platformProvider,
    model,
    mcpClientManager: clients,
    includeSubAgent: true,
    maxSteps,
  })

  logger.debug('Tools:', Object.keys(tools))

  // biome-ignore lint/suspicious/noExplicitAny: fine for GenerateTextResult generics
  let latestResult: GenerateTextResult<Record<string, any>, string> | null = null
  let currentPrompt = initialPrompt
  let accumulatedContext = ''
  let summaryToolCalled = false

  let tokenUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  }
  let toolUsage: ToolCall[] = []

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    logger.info(`Attempt ${attempt}/${maxRetries}...`)
    summaryToolCalled = false

    latestResult = await reviewAgent(currentPrompt, model, maxSteps, tools, () => {
      summaryToolCalled = true
    })

    tokenUsage = accumulateTokenUsage(tokenUsage, latestResult.steps)
    toolUsage = formatToolUsage(toolUsage, latestResult.steps, attempt)

    if (summaryToolCalled) {
      logger.info(
        `Agent submitted summary on attempt ${attempt} (detected via callback).`
      )
      break
    }

    logger.warn(`Agent did not submit summary on attempt ${attempt}.`)

    if (attempt < maxRetries) {
      const attemptContext = latestResult.toolResults
        .map((res) => `Tool Result (${res.toolName}): ${JSON.stringify(res.result)}`)
        .join('\n')
      const finalTextContext = latestResult.text
        ? `\nFinal Text: ${latestResult.text}`
        : ''
      accumulatedContext += `\n\n--- Attempt ${attempt} Context ---\n${attemptContext}${finalTextContext}\n--- End Attempt ${attempt} Context ---`
      currentPrompt = `${initialPrompt}${accumulatedContext}\n\nPlease continue the task based on previous attempts and ensure you call submit_summary.`
      logger.info(`Preparing for attempt ${attempt + 1}.`)
    }
  }

  if (!latestResult) {
    throw new Error('Agent did not produce any result.')
  }

  if (!summaryToolCalled) {
    logger.error(
      `Agent failed to submit summary after ${maxRetries} attempts. Proceeding anyway.`
    )
  } else {
    await platformProvider.submitUsage(tokenUsage, toolUsage)
  }

  await clients.closeClients()

  return latestResult.text
}
