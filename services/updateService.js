import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';

export const isApkDownloaded = async (fileName) => {
  try {
    const info = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}${fileName}`);
    return info.exists;
  } catch (e) {
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

    console.log(`[UpdateService] Downloading to: ${downloadDest}`);
    const downloadResumable = FileSystem.createDownloadResumable(
      finalUrl,
      downloadDest,
      { headers: downloadHeaders },
      (downloadProgress) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        if (onProgress) onProgress(progress);
      }
    );

    const result = await downloadResumable.downloadAsync();
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
