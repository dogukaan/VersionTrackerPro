import AsyncStorage from '@react-native-async-storage/async-storage';

const REPOS_KEY = '@version_tracker_repos';

export const storageService = {
  async getRepos() {
    try {
      const jsonValue = await AsyncStorage.getItem(REPOS_KEY);
      return jsonValue != null ? JSON.parse(jsonValue) : [];
    } catch (e) {
      console.error('Error reading repos', e);
      return [];
    }
  },

  async addRepo(repoPath, token = '') {
    try {
      const repos = await this.getRepos();
      const [owner, name] = repoPath.split('/');
      
      const newRepo = {
        id: Date.now().toString(),
        path: repoPath,
        owner,
        name,
        token,
        lastVersion: null,
        lastCheck: new Date().toISOString(),
        hiddenVersions: [] // Array of version IDs or tags to hide
      };

      const updatedRepos = [...repos, newRepo];
      await AsyncStorage.setItem(REPOS_KEY, JSON.stringify(updatedRepos));
      return updatedRepos;
    } catch (e) {
      console.error('Error saving repo', e);
      throw e;
    }
  },

  async removeRepo(id) {
    try {
      const repos = await this.getRepos();
      const updatedRepos = repos.filter(r => r.id !== id);
      await AsyncStorage.setItem(REPOS_KEY, JSON.stringify(updatedRepos));
      return updatedRepos;
    } catch (e) {
      console.error('Error removing repo', e);
      throw e;
    }
  },

  async updateRepoVersion(id, version) {
    try {
      const repos = await this.getRepos();
      const updatedRepos = repos.map(r => 
        r.id === id ? { ...r, lastVersion: version, lastCheck: new Date().toISOString() } : r
      );
      await AsyncStorage.setItem(REPOS_KEY, JSON.stringify(updatedRepos));
      return updatedRepos;
    } catch (e) {
      console.error('Error updating version', e);
    }
  },

  async hideVersion(repoId, versionId) {
    try {
      const repos = await this.getRepos();
      const updatedRepos = repos.map(r => {
        if (r.id === repoId) {
          const hidden = r.hiddenVersions || [];
          if (!hidden.includes(versionId)) {
            return { ...r, hiddenVersions: [...hidden, versionId] };
          }
        }
        return r;
      });
      await AsyncStorage.setItem(REPOS_KEY, JSON.stringify(updatedRepos));
      return updatedRepos;
    } catch (e) {
      console.error('Error hiding version', e);
      throw e;
    }
  }
};
