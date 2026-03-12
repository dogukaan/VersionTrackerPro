import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';

export const downloadAndInstallApk = async (apkUrl, fileName, onProgress, token = null) => {
  console.log(`[UpdateService] Start download: ${fileName}`);
  
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

    // Robust way: First try to get the redirect URL if we're hitting the API
    if (apkUrl.includes('api.github.com')) {
      try {
        console.log('[UpdateService] Resolving redirect URL...');
        const response = await fetch(apkUrl, {
          method: 'GET',
          headers,
          redirect: 'follow' // Let fetch handle the redirect to get the final URL
        });
        
        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.status}`);
        }
        
        // The final URL after redirects (e.g. S3 URL)
        finalUrl = response.url;
        console.log('[UpdateService] Final URL resolved');
      } catch (err) {
        console.error('[UpdateService] Redirect resolution failed:', err);
        // Fallback: keep using the original apkUrl and hope for the best
      }
    }
  }

  if (Platform.OS === 'web') {
    try {
      // If it's a direct browser download URL or no token is provided, always use window.open
      // to avoid CORS issues entirely.
      if (!token || finalUrl.includes('browser_download_url') || finalUrl.includes('github.com/releases/download')) {
        console.log('[UpdateService] Web: Using direct window.open');
        const win = window.open(finalUrl, '_blank');
        if (!win) throw new Error('Popup blocked! Lütfen pop-up izinlerini kontrol edin.');
        return;
      }

      // Only attempt fetch if we absolutely need the headers for a private repo API call
      console.log('[UpdateService] Web: Attempting authenticated fetch...');
      const response = await fetch(finalUrl, { headers });
      
      if (!response.ok) {
        if (response.status === 404) throw new Error('Dosya bulunamadı veya yetki yetersiz.');
        throw new Error(`HTTP ${response.status}`);
      }
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch (err) {
      console.error('[UpdateService] Web download failed:', err);
      
      let msg = err.message;
      if (err.message === 'Failed to fetch') {
        msg = 'CORS Hatası: Tarayıcı güvenliği nedeniyle bu dosya doğrudan indirilemiyor. Lütfen GitHub Token kullanıyorsanız "Public" indirme bağlantısını deneyin veya uygulamayı Android cihazınıza kurun.';
      }
      
      const finalMsg = 'İndirme başarısız: ' + msg;
      if (Platform.OS === 'web') window.alert(finalMsg);
      else Alert.alert('Hata', finalMsg);
    }
    return;
  }

  try {
    const downloadDest = `${FileSystem.cacheDirectory}${fileName}`;
    
    // For the actual download, only send headers if we are still hitting GitHub API
    const downloadHeaders = finalUrl.includes('api.github.com') ? headers : {};

    const downloadResumable = FileSystem.createDownloadResumable(
      finalUrl,
      downloadDest,
      downloadHeaders,
      (downloadProgress) => {
        const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
        if (onProgress) onProgress(progress);
      }
    );

    const { uri } = await downloadResumable.downloadAsync();
    
    if (Platform.OS === 'android') {
      const contentUri = await FileSystem.getContentUriAsync(uri);
      await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
        data: contentUri,
        flags: 1,
      });
    } else {
      await Sharing.shareAsync(uri);
    }
  } catch (error) {
    console.error('[UpdateService] Mobile download error:', error);
    throw error;
  }
};
