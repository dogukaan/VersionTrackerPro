export const fetchReleases = async (repoOwner, repoName, token = null) => {
  try {
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    
    if (token) {
      // Supporting both formats, Bearer is modern, token is classic
      headers['Authorization'] = token.startsWith('ghp_') || token.startsWith('github_pat_') 
        ? `token ${token}` 
        : `Bearer ${token}`;
    }

    const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/releases`, { headers });
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Repository not found or private (needs token)');
      }
      throw new Error(`Failed to fetch releases: ${response.statusText}`);
    }
    const data = await response.json();
    
    // Filter for releases that have APK assets
    const releasesWithApk = data.map(release => {
      const apkAsset = release.assets.find(asset => asset.name.endsWith('.apk'));
      if (!apkAsset) return null;

      return {
        id: release.id,
        version: release.tag_name,
        name: release.name || release.tag_name,
        notes: release.body || '',
        publishedAt: release.published_at,
        repoOwner,
        repoName,
        apkAsset: {
          ...apkAsset,
          apiUrl: apkAsset.url,
          downloadUrl: apkAsset.browser_download_url
        }
      };
    }).filter(release => release !== null);

    // Sort releases by version number (semver-like) descending
    return releasesWithApk.sort((a, b) => {
      const parseVersion = (v) => v.replace(/[^0-9.]/g, '').split('.').map(Number);
      const vA = parseVersion(a.version);
      const vB = parseVersion(b.version);
      
      for (let i = 0; i < Math.max(vA.length, vB.length); i++) {
        const numA = vA[i] || 0;
        const numB = vB[i] || 0;
        if (numA !== numB) return numB - numA;
      }
      return 0;
    });
  } catch (error) {
    console.error('Error fetching releases:', error);
    throw error;
  }
};

export const fetchFileContent = async (repoOwner, repoName, path, token = null) => {
  try {
    const headers = {
      'Accept': 'application/vnd.github.v3.raw',
    };
    if (token) {
      headers['Authorization'] = token.startsWith('ghp_') || token.startsWith('github_pat_') 
        ? `token ${token}` 
        : `Bearer ${token}`;
    }

    const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}`, { headers });
    if (!response.ok) return null;
    return await response.text();
  } catch (error) {
    return null;
  }
};

export const fetchCommits = async (repoOwner, repoName, sha, token = null) => {
  try {
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (token) {
      headers['Authorization'] = token.startsWith('ghp_') || token.startsWith('github_pat_') 
        ? `token ${token}` 
        : `Bearer ${token}`;
    }

    // sha can be a tag name, branch name, or commit SHA
    const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/commits?sha=${sha}&per_page=10`, { headers });
    if (!response.ok) return [];
    
    const data = await response.json();
    return data
      .map(c => ({
        sha: c.sha.substring(0, 7),
        message: c.commit.message,
        author: c.commit.author.name,
        date: c.commit.author.date,
        url: c.html_url
      }))
      .filter(c => {
        const msg = c.message.toLowerCase();
        return !msg.includes('chore') && 
               !msg.includes('pipeline') && 
               !msg.includes('ci/cd') && 
               !msg.includes('update build-android.yml') &&
               !msg.includes('bundled release build') &&
               !msg.includes('update workspace') &&
               !msg.includes('merge');
      });
  } catch (error) {
    console.error('Error fetching commits:', error);
    return [];
  }
};

/**
 * Fetches latest workflow runs to track build status
 */
export const fetchWorkflowRuns = async (owner, repo, token = null) => {
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=10`;
  const headers = { 'Accept': 'application/vnd.github+json' };
  if (token) {
    headers['Authorization'] = token.startsWith('ghp_') || token.startsWith('github_pat_') 
      ? `token ${token}` 
      : `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) return [];
    const data = await response.json();
    return data.workflow_runs || [];
  } catch (error) {
    console.error('[GithubService] Workflow runs fetch failed:', error);
    return [];
  }
};
