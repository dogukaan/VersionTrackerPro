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
    const downloadDest = `${FileSystem.documentDirectory}${fileName}`;
    
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
    const uri = result.uri;
    
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
  } catch (error) {
    console.error('[UpdateService] Mobile error:', error);
    let errorMsg = error.message;
    if (errorMsg.includes('Network request failed')) errorMsg = 'Bağlantı hatası: İnternetinizi kontrol edin.';
    throw new Error(errorMsg);
  }
};
