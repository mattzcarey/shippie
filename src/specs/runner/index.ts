import type { GenerateTextResult, LanguageModelV1, Tool } from 'ai'
import { createModel } from '../../common/llm'
import type { PlatformProvider } from '../../common/platform/provider'
import type { ReviewFile } from '../../common/types'
import { logger } from '../../common/utils/logger'
import { reviewAgent } from '../../review/agent/generate'
import { constructPrompt } from '../../review/prompt'
import type { TestResult, TestScenario, ToolCallInfo } from '../scenarios/types'
import { createTestPlatformProviderWithData } from '../utils/testPlatformProvider'
import { createTestTools, createTestToolsConfig } from '../utils/testTools'

export class ScenarioRunner {
  private model: LanguageModelV1
  private maxSteps: number

  constructor(modelString = 'openai:gpt-4.1-mini', maxSteps = 25) {
    this.model = createModel(modelString)
    this.maxSteps = maxSteps
  }

  async runScenario(scenario: TestScenario): Promise<TestResult> {
    logger.info(`Running scenario: ${scenario.name}`)

    const reviewFiles: ReviewFile[] = scenario.input.files.map((file) => ({
      fileName: file.fileName,
      fileContent: file.content,
      changedLines: (file.changedLines || []).map((line) => ({ start: line, end: line })),
    }))

    const prompt = await constructPrompt(
      reviewFiles,
      'English',
      scenario.input.customInstructions
    )

    let tools: Record<string, Tool>

    // Use test platform provider and tools with controlled data
    const platformProvider: PlatformProvider = createTestPlatformProviderWithData({
      files: scenario.input.files.map((file) => ({
        fileName: file.fileName,
        content: file.content,
        diff: `+++ ${file.fileName}\n@@ -1,${file.content.split('\n').length} +1,${file.content.split('\n').length} @@\n${file.content
          .split('\n')
          .map((line) => `+${line}`)
          .join('\n')}`,
      })),
    })

    const testConfig = createTestToolsConfig({
      files: scenario.input.files.map((file) => ({
        fileName: file.fileName,
        content: file.content,
        diff: `+++ ${file.fileName}\n@@ -1,${file.content.split('\n').length} +1,${file.content.split('\n').length} @@\n${file.content
          .split('\n')
          .map((line) => `+${line}`)
          .join('\n')}`,
      })),
    })

    tools = createTestTools(testConfig, platformProvider, this.model, true, this.maxSteps)

    // biome-ignore lint/suspicious/noExplicitAny: Testing utility needs flexible types
    let result: GenerateTextResult<Record<string, any>, string>
    let summarySubmitted = false

    try {
      result = await reviewAgent(prompt, this.model, this.maxSteps, tools, () => {
        summarySubmitted = true
      })
    } catch (error) {
      return {
        passed: false,
        errors: [
          `Agent execution failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
        toolCalls: [],
        summary: '',
      }
    }

    // Extract tool calls from all steps
    const toolCalls: ToolCallInfo[] = []

    if (result.steps) {
      for (const step of result.steps) {
        if (step.toolCalls) {
          for (const toolCall of step.toolCalls) {
            toolCalls.push({
              toolName: toolCall.toolName,
              args: toolCall.args,
              result: step.toolResults?.find(
                (tr) => tr.toolCallId === toolCall.toolCallId
              )?.result,
            })
          }
        }
      }
    }

    const summary = result.text || ''
    const errors: string[] = []

    errors.push(...this.validateToolCalls(toolCalls, scenario.expectations))
    errors.push(...this.validateSummary(summary, scenario.expectations))

    if (!summarySubmitted) {
      errors.push('Agent did not submit summary via submit_summary tool')
    }

    return {
      passed: errors.length === 0,
      errors,
      toolCalls,
      summary,
    }
  }

  public validateToolCalls(
    toolCalls: ToolCallInfo[],
    expectations: TestScenario['expectations']
  ): string[] {
    const errors: string[] = []
    const toolCallCounts = new Map<string, number>()

    for (const call of toolCalls) {
      toolCallCounts.set(call.toolName, (toolCallCounts.get(call.toolName) || 0) + 1)
    }

    // Validate required tools
    for (const expectedTool of expectations.shouldCallTools) {
      if (!toolCallCounts.has(expectedTool)) {
        errors.push(`Expected tool '${expectedTool}' was not called`)
      }
    }

    // Validate forbidden tools
    if (expectations.shouldNotCallTools) {
      for (const forbiddenTool of expectations.shouldNotCallTools) {
        if (toolCallCounts.has(forbiddenTool)) {
          errors.push(
            `Tool '${forbiddenTool}' should not have been called but was called ${toolCallCounts.get(forbiddenTool)} times`
          )
        }
      }
    }

    // Validate minimum/maximum tool calls
    const totalCalls = toolCalls.length
    if (expectations.minimumToolCalls && totalCalls < expectations.minimumToolCalls) {
      errors.push(
        `Expected at least ${expectations.minimumToolCalls} tool calls, but got ${totalCalls}`
      )
    }
    if (expectations.maximumToolCalls && totalCalls > expectations.maximumToolCalls) {
      errors.push(
        `Expected at most ${expectations.maximumToolCalls} tool calls, but got ${totalCalls}`
      )
    }

    // Validate tool call order
    if (expectations.toolCallOrder) {
      for (const orderExpectation of expectations.toolCallOrder) {
        const beforeIndex = toolCalls.findIndex(
          (call) => call.toolName === orderExpectation.before
        )
        const afterIndex = toolCalls.findIndex(
          (call) => call.toolName === orderExpectation.after
        )

        if (beforeIndex !== -1 && afterIndex !== -1) {
          if (beforeIndex >= afterIndex) {
            const description =
              orderExpectation.description ||
              `'${orderExpectation.before}' should be called before '${orderExpectation.after}'`
            errors.push(`Tool call order violation: ${description}`)
          }
        }
      }
    }

    // Validate specific tool calls
    if (expectations.toolCallValidation) {
      for (const validation of expectations.toolCallValidation) {
        const actualCalls = toolCallCounts.get(validation.toolName) || 0

        if (actualCalls !== validation.expectedCalls) {
          errors.push(
            `Tool '${validation.toolName}' was called ${actualCalls} times, expected ${validation.expectedCalls}`
          )
        }

        if (validation.validateArgs && actualCalls > 0) {
          const relevantCalls = toolCalls.filter(
            (call) => call.toolName === validation.toolName
          )
          for (const call of relevantCalls) {
            const validationResult = validation.validateArgs(call.args)
            if (validationResult !== true) {
              errors.push(
                `Tool '${validation.toolName}' validation failed: ${validationResult}`
              )
            }
          }
        }
      }
    }

    return errors
  }

  public validateSummary(
    summary: string,
    expectations: TestScenario['expectations']
  ): string[] {
    const errors: string[] = []
    const lowerSummary = summary.toLowerCase()

    if (expectations.summaryContains) {
      for (const expectedText of expectations.summaryContains) {
        if (!lowerSummary.includes(expectedText.toLowerCase())) {
          errors.push(`Summary should contain '${expectedText}' but doesn't`)
        }
      }
    }

    if (expectations.summaryDoesNotContain) {
      for (const forbiddenText of expectations.summaryDoesNotContain) {
        if (lowerSummary.includes(forbiddenText.toLowerCase())) {
          errors.push(`Summary should not contain '${forbiddenText}' but does`)
        }
      }
    }

    return errors
  }
}
