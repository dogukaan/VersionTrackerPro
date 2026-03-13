import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';

export const isApkDownloaded = async (fileName) => {
  try {
    const info = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}${fileName}`);
    return info.exists;
  } catch (e) {
    return false;
  }
};

export const deleteApk = async (fileName) => {
  try {
    const path = `${FileSystem.documentDirectory}${fileName}`;
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      await FileSystem.deleteAsync(path, { idempotent: true });
      return true;
    }
    return false;
  } catch (e) {
    console.error('[UpdateService] Delete error:', e);
    return false;
  }
};

export const downloadAndInstallApk = async (apkUrl, fileName, onProgress, token = null) => {
  console.log(`[UpdateService] Starting APK logic: ${fileName}`);
  
  const downloadDest = `${FileSystem.documentDirectory}${fileName}`;
  const fileInfo = await FileSystem.getInfoAsync(downloadDest);

  // If already downloaded, just install
  if (fileInfo.exists) {
    console.log('[UpdateService] APK already cached locally. Skipping download.');
    if (onProgress) onProgress(1); // Immediate 100%
    return await launchInstaller(downloadDest);
  }

  let finalUrl = apkUrl;
  const headers = {
    'X-GitHub-Api-Version': '2022-11-28'
  };
  
  if (token) {
    const authHeader = token.startsWith('ghp_') || token.startsWith('github_pat_') 
      ? `token ${token}` 
      : `Bearer ${token}`;
    headers['Authorization'] = authHeader;
    headers['Accept'] = 'application/octet-stream';

    // Robust way: Resolve redirect for GitHub API asset URLs
    if (apkUrl.includes('api.github.com/repos') && apkUrl.includes('/assets/')) {
      try {
        console.log('[UpdateService] Resolving asset redirect...');
        const response = await fetch(apkUrl, {
          method: 'GET',
          headers,
          redirect: 'follow'
        });
        
        if (response.ok) {
          finalUrl = response.url;
          console.log('[UpdateService] Asset redirect resolved to final URL');
        }
      } catch (err) {
        console.error('[UpdateService] Redirect resolution failed:', err);
      }
    }
  }

  if (Platform.OS === 'web') {
    // ... web logic remains same ...
    return;
  }

  try {
    // For the actual download, only send headers if we are still hitting GitHub API
    const downloadHeaders = finalUrl.includes('api.github.com') ? headers : {};

    // Pre-clean for fresh download (Fixes Parse Error)
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(downloadDest);
    }

    console.log(`[UpdateService] Downloading to: ${downloadDest}`);
    
    // Create progress notification
    const notificationId = `download-${fileName}`;
    let lastProgress = 0;

    const downloadResumable = FileSystem.createDownloadResumable(
      finalUrl,
      downloadDest,
      { headers: downloadHeaders },
      async (downloadProgress) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        if (onProgress) onProgress(progress);

        // Update notification every 5% to avoid spamming
        if (progress - lastProgress > 0.05 || progress === 1) {
          lastProgress = progress;
          await Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: false,
              shouldPlaySound: false,
              shouldSetBadge: false,
            }),
          });
          
          await Notifications.scheduleNotificationAsync({
            identifier: notificationId,
            content: {
              title: `${fileName} İndiriliyor`,
              body: `İlerleme: %${Math.round(progress * 100)}`,
              sticky: true,
              color: '#007AFF',
            },
            trigger: null,
          });
        }
      }
    );

    const result = await downloadResumable.downloadAsync();
    
    // Clear notification on finish
    await Notifications.dismissNotificationAsync(notificationId);

    if (!result || !result.uri) throw new Error('Dosya indirilemedi (Stream hatası)');
    
    await launchInstaller(result.uri);
  } catch (error) {
    console.error('[UpdateService] Mobile error:', error);
    let errorMsg = error.message;
    if (errorMsg.includes('Network request failed')) errorMsg = 'Bağlantı hatası: İnternetinizi kontrol edin.';
    throw new Error(errorMsg);
  }
};

const launchInstaller = async (uri) => {
  if (Platform.OS === 'android') {
    try {
      console.log('[UpdateService] Launching Android Installer...');
      const contentUri = await FileSystem.getContentUriAsync(uri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1,
        type: 'application/vnd.android.package-archive'
      });
    } catch (intentErr) {
      console.error('[UpdateService] Intent failed, using Sharing fallback:', intentErr);
      if (await Sharing.isAvailableAsync()) {
        Alert.alert(
          'Yükleme Başlatılamadı', 
          'Otomatik yükleme başlatılamadı. Lütfen dosyayı "Kaydet" veya "Dosyalarım ile aç" seçeneğiyle yükleyin.',
          [{ text: 'Tamam', onPress: () => Sharing.shareAsync(uri) }]
        );
      } else {
        throw new Error('Yükleyici başlatılamadı ve paylaşım desteklenmiyor.');
      }
    }
  } else {
    await Sharing.shareAsync(uri);
  }
};
