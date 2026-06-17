import {
  type GenerateTextResult,
  type LanguageModelV1,
  type Tool,
  generateText,
} from "ai";
import { logger } from "../../common/utils/logger";
import { createOpencode } from "@opencode-ai/sdk";

export const reviewAgent = async (
  prompt: string,
  model: LanguageModelV1,
  maxSteps: number,
  tools: Record<string, Tool>,
  onSummarySubmit?: () => void
  // biome-ignore lint/suspicious/noExplicitAny: fine
): Promise<GenerateTextResult<Record<string, any>, string>> => {
  const { client } = await createOpencode();

  const session = await client.session.create();
  const id = session.data?.id as string;

  const agent = await client.session.prompt({
    path: { id },
    body: {
      parts: [
        {
          text: prompt,
          type: "text",
        },
      ],
    },
  });

  // return generateText({
  //   model,
  //   prompt,
  //   tools,
  //   maxSteps,
  //   onStepFinish: (step) => {
  //     logger.debug('Step finished:', step)

  //     const summaryToolUsed = step.toolCalls.some(
  //       (tc) => tc.toolName === 'submit_summary'
  //     )

  //     if (summaryToolUsed && onSummarySubmit) {
  //       logger.debug('Detected submit_summary tool usage in step, triggering callback.')
  //       onSummarySubmit()
  //     }
  //   },
  // })
};
