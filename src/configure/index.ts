import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { password } from '@inquirer/prompts'

import { type ConfigureArgs, PlatformOptions } from '../common/types'
import { logger } from '../common/utils/logger'
import { findTemplateFile } from './findTemplateFile'

export const configure = async (yargs: ConfigureArgs): Promise<void> => {
  if (yargs.platform === PlatformOptions.GITHUB) {
    await configureGitHub()
  }
  if (yargs.platform === PlatformOptions.GITLAB) {
    await configureGitLab()
  }
  if (yargs.platform === PlatformOptions.AZDEV) {
    await configureAzureDevOps()
  }
}

const captureGitHubApiKey = async (): Promise<string | undefined> => {
  const apiKey = await password({
    message: 'Please input your OpenAI API key (leave blank to use GitHub Models):',
    mask: '*',
  })

  if (!apiKey) {
    logger.info('No API key provided, using GitHub Models.')
    return undefined
  }

  return apiKey
}

const captureApiKey = async (): Promise<string> => {
  const apiKey = await password({
    message: 'Please input your OpenAI API key:',
  })

  return apiKey
}

const configureGitHub = async () => {
  const apiKey = await captureGitHubApiKey()

  // Choose template based on whether we're using GitHub Models or OpenAI
  const templateName = apiKey ? 'github-pr.yml' : 'github-pr-models.yml'
  const githubWorkflowTemplate = await findTemplateFile(`**/templates/${templateName}`)

  const workflowsDir = path.join(process.cwd(), '.github', 'workflows')
  fs.mkdirSync(workflowsDir, { recursive: true })

  const workflowFile = path.join(workflowsDir, 'shippie.yml')
  fs.writeFileSync(workflowFile, fs.readFileSync(githubWorkflowTemplate, 'utf8'), 'utf8')

  logger.info(`Created GitHub Actions workflow at: ${workflowFile}`)

  if (apiKey) {
    try {
      execSync('gh auth status || gh auth login', { stdio: 'inherit' })
      execSync(`gh secret set OPENAI_API_KEY --body=${String(apiKey)}`)
      logger.info(
        'Successfully added the OPENAI_API_KEY secret to your GitHub repository.'
      )
    } catch (error) {
      logger.error(
        "It seems that the GitHub CLI is not installed or there was an error during authentication. Don't forget to add the OPENAI_API_KEY to the repo settings/Environment/Actions/Repository Secrets manually."
      )
    }
  }
}

const configureGitLab = async () => {
  const gitlabPipelineTemplate = await findTemplateFile('**/templates/gitlab-pr.yml')

  const pipelineDir = process.cwd()
  const pipelineFile = path.join(pipelineDir, '.gitlab-ci.yml')

  fs.writeFileSync(pipelineFile, fs.readFileSync(gitlabPipelineTemplate, 'utf8'), 'utf8')

  logger.info(`Created GitLab CI at: ${pipelineFile}`)

  const apiKey = await captureApiKey()

  if (!apiKey) {
    logger.error(
      'No API key provided. Please manually add the OPENAI_API_KEY secret to your GitLab CI/CD environment variables for your repository.'
    )

    return
  }

  try {
    execSync('glab auth login', { stdio: 'inherit' })
    execSync(`glab variable set OPENAI_API_KEY ${String(apiKey)}`)
    logger.info(
      'Successfully added the OPENAI_API_KEY secret to your GitLab repository.\n Please make sure you have set up your Gitlab access token before using this tool. Refer to the README (Gitlab CI section) for information on how to do this.'
    )
  } catch (error) {
    logger.error(
      "It seems that the GitLab CLI is not installed or there was an error during authentication. Don't forget to add the OPENAI_API_KEY and the GITLAB_TOKEN to the repo's CI/CD Variables manually. Refer to the README (Gitlab CI section)for information on how to set up your access token."
    )
  }
}

const configureAzureDevOps = async () => {
  const azdevPipelineTemplate = await findTemplateFile('**/templates/azdev-pr.yml')

  const pipelineDir = process.cwd()
  const pipelineFile = path.join(pipelineDir, 'shippie.yaml')

  fs.writeFileSync(pipelineFile, fs.readFileSync(azdevPipelineTemplate, 'utf8'), 'utf8')

  logger.info(`Created Azure DevOps Pipeline at: ${pipelineFile}`)

  logger.info(
    'Please manually add the OPENAI_API_KEY and API_TOKEN secrets as encrypted variables in the UI.'
  )
}
