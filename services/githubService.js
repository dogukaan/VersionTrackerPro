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
    return data.map(release => {
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
