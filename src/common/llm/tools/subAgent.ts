import { generateText, type LanguageModelV1, tool } from 'ai'
import { z } from 'zod'
import { logger } from '../../utils/logger'
import { MCPClientManager } from '../mcp/client'
import { getAllTools } from './index'

const submitReportTool = tool({
  description: 'Submit a report to the main agent. This is how you finish your work.',
  parameters: z.object({
    report: z.string().describe('The report to submit to the main agent'),
  }),
})

export const createSubAgentTool = (parentModel: LanguageModelV1, maxSteps: number) => {
  return tool({
    description:
      'Spawn a sub-agent with a specific goal that runs autonomously with access to all available tools. The sub-agent will work towards the goal and return a structured report with findings and recommendations. Use this subagent to run token heavy tasks which can be run async from the main agent.',
    parameters: z.object({
      goal: z
        .string()
        .describe(
          'The specific goal or task for the sub-agent to accomplish. Include as much context as possible to help the sub-agent understand the goal.'
        ),
    }),
    execute: async ({ goal }) => {
      try {
        logger.info(`Spawning sub-agent with goal: ${goal}`)
        const model: LanguageModelV1 = parentModel

        const mcpClientManager = new MCPClientManager()
        await mcpClientManager.loadConfig()
        await mcpClientManager.startClients()

        const allTools = await getAllTools({
          model,
          mcpClientManager,
        })

        const tools = {
          submit_report: submitReportTool,
          ...allTools,
        }

        logger.debug('Sub-agent tools available:', Object.keys(tools))

        // Create the prompt for the sub-agent
        const prompt = `You are an autonomous sub-agent with the following goal: ${goal}

You have access to various tools to help you accomplish this goal. Work systematically towards the goal, using the available tools as needed. 

CRITICAL REQUIREMENT: You MUST end your work by providing a comprehensive final report that includes:

## Summary
Brief overview of what was accomplished

## Findings
Detailed findings, discoveries, or analysis results

## Recommendations  
Any suggestions, improvements, or next steps (if applicable)

## Conclusion
Final assessment and key takeaways

Submit the report to the main agent using the 'submit_report' tool.`

        // Run the sub-agent
        const result = await generateText({
          model,
          prompt,
          tools,
          maxSteps,
        })

        await mcpClientManager.closeClients()

        if (result.toolCalls.length > 0) {
          return result.toolCalls[0].args.report
        }

        logger.error('Sub-agent completed execution but produced no report output')
        logger.error('Sub-agent result finishReason:', result.finishReason)
        logger.debug('Sub-agent result steps:', result.steps)
        logger.info('Sub-agent result text:', result.text)

        if (result.text) {
          logger.info('Sub-agent result text:', result.text)

          return result.text
        }

        return 'Sub-agent completed execution but produced no report output'
      } catch (error) {
        logger.error('Error in sub-agent execution:', error)
        if (error instanceof Error) {
          return `Error executing sub-agent: ${error.message}`
        }
        return 'Unknown error occurred while executing sub-agent'
      }
    },
  })
}
