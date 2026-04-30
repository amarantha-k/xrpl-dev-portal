import * as React from 'react';
import styled from 'styled-components';

export type Contributor = {
  login: string;
  avatarUrl: string;
  profileUrl: string;
};

/** Minimal shape of a GitHub commit author/committer object in the API response */
type GitHubActor = {
  login: string;
  avatar_url: string;
  html_url: string;
};

/** Minimal shape of a single GitHub commit item returned by the commits API */
type GitHubCommit = {
  author: GitHubActor | null;
  committer: GitHubActor | null;
};

export type AttributionProps = {
  /** Full GitHub edit/tree URL, e.g. https://github.com/XRPLF/xrpl-dev-portal/tree/master/docs/foo.md */
  editPageUrl: string;
};

/**
 * Parses a GitHub tree/blob URL and returns the API endpoint to list commits
 * for that file, along with author metadata.
 */
function parseGitHubUrl(url: string): { apiUrl: string; repoUrl: string } | null {
  // Expected format: https://github.com/{owner}/{repo}/tree/{branch}/{path}
  const match = url.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:tree|blob)\/([^/]+)\/(.+)$/
  );
  if (!match) return null;

  const [, owner, repo, , filePath] = match;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits?path=${encodeURIComponent(
    filePath
  )}&per_page=100`;
  const repoUrl = `https://github.com/${owner}/${repo}`;
  return { apiUrl, repoUrl };
}

/**
 * Fetches the list of unique contributors for a given file via the GitHub
 * commits API. Returns an empty array on error (e.g. rate-limit exceeded).
 */
async function fetchContributors(editPageUrl: string): Promise<Contributor[]> {
  const parsed = parseGitHubUrl(editPageUrl);
  if (!parsed) return [];

  try {
    const response = await fetch(parsed.apiUrl, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) return [];

    const commits: GitHubCommit[] = await response.json();

    const seen = new Set<string>();
    const contributors: Contributor[] = [];

    for (const commit of commits) {
      // Prefer the commit author; fall back to the committer (e.g. bots or
      // commits made before the author had a GitHub account).
      const actor = commit.author ?? commit.committer;
      if (!actor || !actor.login || seen.has(actor.login)) continue;
      seen.add(actor.login);
      contributors.push({
        login: actor.login,
        avatarUrl: actor.avatar_url,
        profileUrl: actor.html_url,
      });
    }

    return contributors;
  } catch {
    return [];
  }
}

export function Attribution({ editPageUrl }: AttributionProps): JSX.Element | null {
  const [contributors, setContributors] = React.useState<Contributor[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchContributors(editPageUrl).then((result) => {
      if (!cancelled) {
        setContributors(result);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [editPageUrl]);

  if (loading || contributors.length === 0) return null;

  return (
    <AttributionWrapper data-component-name="Attribution/Attribution">
      <AttributionTitle>Contributors</AttributionTitle>
      <ContributorList>
        {contributors.map((contributor) => (
          <ContributorItem key={contributor.login}>
            <ContributorLink
              href={contributor.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={contributor.login}
            >
              <ContributorAvatar
                src={`${contributor.avatarUrl}&s=64`}
                alt={contributor.login}
                loading="lazy"
                width={32}
                height={32}
              />
            </ContributorLink>
          </ContributorItem>
        ))}
      </ContributorList>
    </AttributionWrapper>
  );
}

// ---------------------------------------------------------------------------
// Styled components — using existing CSS custom properties and design tokens
// ---------------------------------------------------------------------------

const AttributionWrapper = styled.section`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
  border-top: 1px solid var(--color-gray-7, #343437);
  margin-top: 32px;
  flex-wrap: wrap;

  html.light & {
    border-top-color: var(--color-gray-2, #e0e0e1);
  }
`;

const AttributionTitle = styled.span`
  font-size: var(--font-size-sm, 0.875rem);
  font-weight: var(--font-weight-bold, 600);
  color: var(--text-color-secondary, #838386);
  white-space: nowrap;
  font-family: var(--font-family-base, inherit);
`;

const ContributorList = styled.ul`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  list-style: none;
  margin: 0;
  padding: 0;
`;

const ContributorItem = styled.li`
  margin: 0;
`;

const ContributorLink = styled.a`
  display: block;
  border-radius: 50%;
  line-height: 0;
  transition: opacity 0.15s ease, transform 0.15s ease;
  text-decoration: none !important;

  &:hover {
    opacity: 0.85;
    transform: scale(1.08);
  }

  &:focus-visible {
    outline: 2px solid var(--color-purple-4, #9a52ff);
    outline-offset: 2px;
  }
`;

const ContributorAvatar = styled.img`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: block;
  object-fit: cover;
`;
