import { GithubLogo, Star } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { NavbarButton } from './ui/resizable-navbar'

interface GitHubStarsProps {
  repoUrl: string
  collapsed?: boolean
  visible?: boolean
}

interface GitHubRepoResponse {
  stargazers_count: number
  [key: string]: unknown
}

const extractRepoInfo = (repoUrl: string) => {
  try {
    const url = new URL(repoUrl)
    const pathSegments = url.pathname.split('/').filter(Boolean)
    if (pathSegments.length >= 2) {
      return {
        owner: pathSegments[0],
        repo: pathSegments[1],
      }
    }
  } catch (error) {
    console.error('Failed to parse repository URL:', error)
  }
  return null
}

const fetchStarCount = async (owner: string, repo: string): Promise<string> => {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch repo information: ${response.statusText}`)
  }
  const data = (await response.json()) as GitHubRepoResponse
  const starCount = data.stargazers_count
  return `${(Math.round(Number(starCount) / 100) / 10).toFixed(1)}k`
}

const GitHubStars = ({
  repoUrl,
  collapsed = false,
  visible = false,
}: GitHubStarsProps) => {
  const shouldCollapse = visible || collapsed
  const repoInfo = extractRepoInfo(repoUrl)

  const {
    data: starCount,
    isLoading,
    error,
  } = useQuery<string>({
    queryKey: ['github-stars', repoInfo?.owner, repoInfo?.repo],
    queryFn: () =>
      repoInfo ? fetchStarCount(repoInfo.owner, repoInfo.repo) : Promise.resolve('0.0k'),
    enabled: !!repoInfo,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 60, // 1 hour
  })

  return (
    <NavbarButton
      as="a"
      href={repoUrl}
      variant="secondary"
      className={`flex items-center gap-2 font-normal ${shouldCollapse ? 'p-2' : ''}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      {shouldCollapse ? (
        <GithubLogo size={18} weight="fill" className="text-black dark:text-white" />
      ) : (
        <>
          <GithubLogo size={18} weight="fill" className="text-black dark:text-white" />
          <Star size={16} weight="fill" className="text-black dark:text-white" />
          <span className="text-xs opacity-60">
            {isLoading ? '...' : error ? 'N/A' : starCount}
          </span>
        </>
      )}
    </NavbarButton>
  )
}

export default GitHubStars
