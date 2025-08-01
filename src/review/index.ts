import { Telemetry } from '../common/api/telemetry'
import { getFilesWithChanges } from '../common/git/getFilesWithChanges'
import { type ModelCreationOptions, createModel } from '../common/llm/models'
import { getPlatformProvider } from '../common/platform/factory'
import type { ReviewArgs, ReviewFile } from '../common/types'
import { logger } from '../common/utils/logger'
import { runAgenticReview } from './agent'
import { constructPrompt } from './prompt'
import { filterFiles } from './utils/filterFiles'

export const review = async (yargs: ReviewArgs): Promise<void> => {
  logger.debug('Review started.')
  logger.debug(`Model used: ${yargs.modelString}`)
  logger.debug(`Review language: ${yargs.reviewLanguage}`)
  logger.debug(`Platform: ${yargs.platform}`)
  logger.debug(`Max steps: ${yargs.maxSteps}`)
  logger.debug(`Telemetry: ${yargs.telemetry}`)
  logger.debug(`Ignored file globs: ${yargs.ignore}`)
  logger.debug(`Custom instructions: ${yargs.customInstructions}`)

  const trimmedBaseUrl = yargs.baseUrl?.trim()
  const modelCreationOptions: ModelCreationOptions = trimmedBaseUrl
    ? { baseURL: trimmedBaseUrl }
    : {}
  logger.debug(`Model Options: ${JSON.stringify(modelCreationOptions)}`)

  const platformProvider = await getPlatformProvider(yargs.platform)
  logger.debug('Platform provider:', platformProvider)

  if (yargs.telemetry) {
    logger.info(
      'Shippie collects anonymous usage data to help improve the product. You can opt out by setting --telemetry=false when running Shippie.'
    )
    const telemetry = new Telemetry(yargs, platformProvider)
    telemetry.startReview()
  }

  const files: ReviewFile[] = await getFilesWithChanges(yargs.platform)
  logger.debug(`Found ${files.length} changed files.`)

  const filteredFiles = filterFiles(files, yargs.ignore)
  logger.debug(`Filtered ${filteredFiles.length} files to review.`)

  if (filteredFiles.length === 0) {
    logger.info('No file to review, finishing review now.')
    return
  }
  logger.debug(
    `Files to review after filtering: ${filteredFiles.map((file) => file.fileName)}`
  )

  const model = createModel(yargs.modelString, modelCreationOptions)
  const prompt = await constructPrompt(
    filteredFiles,
    yargs.reviewLanguage,
    yargs.customInstructions
  )
  logger.debug('Prompt:', prompt)

  try {
    const message = await runAgenticReview(
      prompt,
      model,
      platformProvider,
      yargs.maxSteps
    )

    logger.debug('Review response:', message)
    logger.info('Review completed successfully.')
  } catch (error: unknown) {
    logger.error('Review failed with error:', error)
    process.exit(1)
  }
}
