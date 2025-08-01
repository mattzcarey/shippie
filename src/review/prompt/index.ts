import { getGitRoot } from '../../common/git/getChangedFilesNames'
import { getMaxPromptLength } from '../../common/llm/promptLength'
import type { ReviewFile } from '../../common/types'
import { logger } from '../../common/utils/logger'
import {
  type ImportantFile,
  type RuleFile,
  findImportantFiles,
  findRulesFiles,
  formatRulesContext,
} from '../utils/rulesFiles'
import { createFileInfo } from './fileInfo'
import { instructionPrompt } from './prompts'
import { getLanguageName } from './utils/fileLanguage'

const truncateRulesContext = (
  rulesFiles: RuleFile[],
  importantFiles: ImportantFile[],
  maxLength: number
): string => {
  if (maxLength <= 0) return ''

  let context = '\n\n// Project Context\n'
  let remainingLength = maxLength - context.length

  const briefRules = rulesFiles.filter((rule) => !rule.frontmatter?.alwaysApply)
  const alwaysApplyRules = rulesFiles.filter((rule) => rule.frontmatter?.alwaysApply)

  if (briefRules.length > 0 && remainingLength > 50) {
    const briefSection = 'See these rules files for more info:\n'
    context += briefSection
    remainingLength -= briefSection.length

    for (const rule of briefRules) {
      const ruleText = `- ${rule.path}: ${rule.description}\n`
      const globsText = rule.frontmatter?.globs?.length
        ? `  Applies to: ${rule.frontmatter.globs.join(', ')}\n`
        : ''
      const totalRuleText = ruleText + globsText

      if (remainingLength >= totalRuleText.length) {
        context += totalRuleText
        remainingLength -= totalRuleText.length
      }
    }
    context += '\n'
    remainingLength -= 1
  }

  if (alwaysApplyRules.length > 0 && remainingLength > 100) {
    const alwaysApplySection = 'Always-apply rules (truncated if needed):\n'
    context += alwaysApplySection
    remainingLength -= alwaysApplySection.length

    for (const rule of alwaysApplyRules) {
      const header = `\n## ${rule.path}\n`
      if (remainingLength >= header.length + 50) {
        context += header
        remainingLength -= header.length

        const availableForContent = remainingLength - 50
        const truncatedContent =
          rule.content.length > availableForContent
            ? `${rule.content.slice(0, availableForContent)}...\n`
            : `${rule.content}\n`

        context += truncatedContent
        remainingLength -= truncatedContent.length
      }
    }
  }

  if (importantFiles.length > 0 && remainingLength > 100) {
    const importantSection = 'Important project documentation (truncated if needed):\n'
    if (remainingLength >= importantSection.length) {
      context += importantSection
      remainingLength -= importantSection.length

      for (const file of importantFiles) {
        const header = `\n## ${file.path}\n`
        if (remainingLength >= header.length + 50) {
          context += header
          remainingLength -= header.length

          const availableForContent = remainingLength - 50
          const truncatedContent =
            file.content.length > availableForContent
              ? `${file.content.slice(0, availableForContent)}...\n`
              : `${file.content}\n`

          context += truncatedContent
          remainingLength -= truncatedContent.length
        }
      }
    }
  }

  return context
}

export const constructPrompt = async (
  files: ReviewFile[],
  reviewLanguage: string,
  customInstructions?: string,
  modelString?: string
): Promise<string> => {
  const workspaceRoot = await getGitRoot()

  const languageName = files.length > 0 ? getLanguageName(files[0].fileName) : 'default'

  const languageToInstructionPrompt = instructionPrompt
    .replace('{ProgrammingLanguage}', languageName)
    .replace('{ReviewLanguage}', reviewLanguage)

  const fileInfo = createFileInfo(files, workspaceRoot)

  const [rulesFiles, importantFiles] = await Promise.all([
    findRulesFiles(workspaceRoot),
    findImportantFiles(workspaceRoot),
  ])

  const rulesContext = formatRulesContext(rulesFiles, importantFiles)

  const customInstructionsSection = customInstructions
    ? `\n\n// Custom Instructions\n${customInstructions}\n`
    : ''

  const prompt = `${languageToInstructionPrompt}${customInstructionsSection}${rulesContext}\n${fileInfo}`

  logger.debug('Prompt component sizes:')
  logger.debug(`  - Base instruction: ${languageToInstructionPrompt.length} chars`)
  logger.debug(`  - Custom instructions: ${customInstructionsSection.length} chars`)
  logger.debug(`  - Rules context: ${rulesContext.length} chars`)
  logger.debug(`  - File info: ${fileInfo.length} chars`)
  logger.debug(
    `  - Total initial: ${prompt.length} chars (~${Math.round(prompt.length / 3)} tokens)`
  )

  if (modelString) {
    const maxLength = getMaxPromptLength(modelString)
    logger.debug(`Model ${modelString} max length: ${maxLength} chars`)

    if (prompt.length > maxLength) {
      logger.warn(
        `Prompt length (${prompt.length} chars) exceeds model limit (${maxLength} chars). Truncating rules context.`
      )
      const availableForRules = maxLength - (prompt.length - rulesContext.length)
      logger.debug(
        `Available space for rules context: ${availableForRules} chars (was ${rulesContext.length} chars)`
      )

      const truncatedRulesContext = truncateRulesContext(
        rulesFiles,
        importantFiles,
        availableForRules
      )
      const finalPrompt = `${languageToInstructionPrompt}${customInstructionsSection}${truncatedRulesContext}\n${fileInfo}`

      logger.info(`Prompt truncated from ${prompt.length} to ${finalPrompt.length} chars`)

      if (finalPrompt.length > maxLength) {
        logger.error(
          `Even after truncation, prompt is still too large: ${finalPrompt.length} chars > ${maxLength} chars`
        )
        logger.error('This suggests the base prompt + file info exceeds model limits')
        logger.error(
          `Base components: instruction(${languageToInstructionPrompt.length}) + custom(${customInstructionsSection.length}) + fileInfo(${fileInfo.length}) = ${languageToInstructionPrompt.length + customInstructionsSection.length + fileInfo.length} chars`
        )
      }

      return finalPrompt
    }
  }

  logger.debug(`Final prompt length: ${prompt.length} chars`)
  return prompt
}
