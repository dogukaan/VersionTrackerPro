import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { storageService } from './storageService';
import { fetchReleases } from './githubService';
import { downloadAndInstallApk } from './updateService';

const BACKGROUND_UPDATE_TASK = 'background-update-check';

TaskManager.defineTask(BACKGROUND_UPDATE_TASK, async () => {
  try {
    console.log('[BackgroundJob] Running version check...');
    const repos = await storageService.getRepos();
    let updatesFound = 0;

    for (const repo of repos) {
      try {
        const releases = await fetchReleases(repo.owner, repo.name, repo.token);
        if (releases.length > 0) {
          const latest = releases[0];
          if (latest.version !== repo.lastVersion) {
            console.log(`[BackgroundJob] New version found for ${repo.path}: ${latest.version}`);
            
            // Notify user
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'Yeni Güncelleme Bulundu!',
                body: `${repo.name} için ${latest.version} sürümü otomatik indiriliyor.`,
              },
              trigger: null,
            });

            // Trigger download/install
            // Note: This might be restricted by background execution limits on some Android versions.
            await downloadAndInstallApk(
              latest.apkAsset.apiUrl || latest.apkAsset.downloadUrl,
              latest.apkAsset.name,
              null,
              repo.token
            );

            await storageService.updateRepoVersion(repo.id, latest.version);
            updatesFound++;
          }
        }
      } catch (err) {
        console.error(`[BackgroundJob] Failed to check ${repo.path}:`, err);
      }
    }

    return updatesFound > 0 
      ? BackgroundFetch.BackgroundFetchResult.NewData 
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('[BackgroundJob] Task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export const registerBackgroundTasks = async () => {
  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_UPDATE_TASK, {
      minimumInterval: 60 * 60, // 1 hour
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log('[BackgroundJob] Task registered successfully');
  } catch (err) {
    console.error('[BackgroundJob] Registration failed:', err);
  }
};
