import 'punycode';
import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator, 
  StatusBar as RNStatusBar,
  Platform,
  Alert,
  Dimensions,
  LayoutAnimation,
  UIManager
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { 
  Github, 
  Plus, 
  ChevronRight, 
  Trash2, 
  Hash, 
  Calendar, 
  RefreshCw,
  ArrowLeft,
  X,
  Search,
  Key,
  Download,
  Info
} from 'lucide-react-native';

// Services & Components
import { storageService } from './services/storageService';
import { fetchReleases } from './services/githubService';
import { downloadAndInstallApk } from './services/updateService';
import { registerBackgroundTasks } from './services/backgroundService';
import * as Notifications from 'expo-notifications';
import { GlassCard } from './components/GlassCard';
import { VersionModal } from './components/VersionModal';
import { isApkDownloaded } from './services/updateService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

export default function App() {
  // Navigation & UI State
  const [currentScreen, setCurrentScreen] = useState('home'); // 'home' or 'detail'
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);
  
  // Data State
  const [repos, setRepos] = useState([]);
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [cachedApks, setCachedApks] = useState({}); // { fileName: true }

  // Form State
  const [newRepoPath, setNewRepoPath] = useState('');
  const [newToken, setNewToken] = useState('');

  // Initialization
  useEffect(() => {
    loadRepos();
    setupApp();
  }, []);

  const setupApp = async () => {
    await registerBackgroundTasks();
    await Notifications.requestPermissionsAsync();
  };

  const loadRepos = async () => {
    const savedRepos = await storageService.getRepos();
    setRepos(savedRepos);
    checkLocalFiles();
    
    // Check for updates on startup
    checkAllForUpdates(savedRepos);
  };

  const checkLocalFiles = async () => {
    // Only check if we are in detail view and have releases
    if (releases.length === 0) return;
    
    const status = {};
    for (const rel of releases) {
      if (rel.apkAsset) {
        status[rel.apkAsset.name] = await isApkDownloaded(rel.apkAsset.name);
      }
    }
    setCachedApks(status);
  };

  const checkAllForUpdates = async (repoList) => {
    for (const repo of repoList) {
      try {
        const results = await fetchReleases(repo.owner, repo.name, repo.token);
        if (results.length > 0) {
          const latest = results[0];
          if (latest.version !== repo.lastVersion) {
            console.log(`Update found for ${repo.path}: ${latest.version}`);
            handleInstall(latest, repo.token);
            await storageService.updateRepoVersion(repo.id, latest.version);
          }
        }
      } catch (err) {
        console.error(`Quick check failed for ${repo.path}`, err);
      }
    }
  };

  const handleAddRepo = async () => {
    if (!newRepoPath.includes('/')) {
      Alert.alert('Hata', 'Lütfen "kullanıcı/repo" formatında girin.');
      return;
    }

    setLoading(true);
    try {
      const updated = await storageService.addRepo(newRepoPath, newToken);
      setRepos(updated);
      setNewRepoPath('');
      setNewToken('');
      setShowAddModal(false);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch (err) {
      Alert.alert('Hata', 'Repo eklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRepo = async (id) => {
    Alert.alert(
      'Repo Sil',
      'Bu repoyu listenizden kaldırmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Sil', 
          style: 'destructive',
          onPress: async () => {
            const updated = await storageService.removeRepo(id);
            setRepos(updated);
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          }
        }
      ]
    );
  };

  const handleSelectRepo = async (repo) => {
    setSelectedRepo(repo);
    setLoading(true);
    setCurrentScreen('detail');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    
    try {
      const results = await fetchReleases(repo.owner, repo.name, repo.token);
      setReleases(results);
      if (results.length > 0) {
        await storageService.updateRepoVersion(repo.id, results[0].version);
        setRepos(await storageService.getRepos());
      }
    } catch (err) {
      Alert.alert('Hata', 'Versiyonlar çekilemedi: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (version, token) => {
    const asset = version.apkAsset;
    if (!asset) return;

    setDownloadingId(version.id);
    setProgress(0);

    try {
      const downloadUrl = (token && asset.apiUrl) ? asset.apiUrl : asset.downloadUrl;
      await downloadAndInstallApk(
        downloadUrl,
        asset.name,
        (p) => setProgress(p),
        token
      );
    } catch (err) {
      Alert.alert('Hata', err.message || 'İndirme veya kurulum başarısız oldu.');
    } finally {
      setDownloadingId(null);
      setProgress(0);
      checkLocalFiles(); // Refresh cache status
    }
  };

  const navigateBack = () => {
    setCurrentScreen('home');
    setReleases([]);
    setSelectedRepo(null);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  // Renderers
  const renderRepoItem = ({ item }) => (
    <TouchableOpacity onPress={() => handleSelectRepo(item)} activeOpacity={0.7}>
      <GlassCard style={styles.repoCard}>
        <View style={styles.repoInfo}>
          <View style={styles.repoIconContainer}>
            <Github color="#fff" size={24} />
          </View>
          <View style={styles.repoTextGroup}>
            <Text style={styles.repoName}>{item.name}</Text>
            <Text style={styles.repoOwner}>{item.owner}</Text>
          </View>
        </View>
        <View style={styles.repoStatus}>
          {item.lastVersion && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.lastVersion}</Text>
            </View>
          )}
          <TouchableOpacity onPress={() => handleDeleteRepo(item.id)} style={styles.deleteAction}>
            <Trash2 size={18} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );

  const renderReleaseItem = ({ item }) => {
    if (!item) return null;
    return (
      <TouchableOpacity onPress={() => setSelectedVersion(item)} activeOpacity={0.8}>
        <GlassCard style={styles.releaseCard}>
          <View style={styles.releaseLeft}>
            <Text style={styles.versionLabel}>{item.version || 'Bilinmiyor'}</Text>
            <Text style={styles.releaseDate}>
              {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('tr-TR') : ''}
              {cachedApks[item.apkAsset?.name] && <Text style={{ color: '#34C759', fontWeight: '800' }}> • İNDİRİLDİ</Text>}
            </Text>
          </View>
          <View style={styles.releaseRight}>
            {downloadingId === item.id ? (
              <View style={styles.downloadProgressContainer}>
                <ActivityIndicator size="small" color="#34C759" />
                <Text style={styles.progressText}>%{Math.round(progress * 100)}</Text>
              </View>
            ) : (
              <View style={styles.actionButtonGroup}>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.downloadButton, cachedApks[item.apkAsset?.name] && { backgroundColor: '#007AFF' }]}
                  onPress={() => handleInstall(item, selectedRepo?.token)}
                >
                  {cachedApks[item.apkAsset?.name] ? (
                    <Box size={20} color="#fff" />
                  ) : (
                    <Download size={20} color="#fff" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.detailButton]}
                  onPress={() => {
                    setSelectedVersion(item);
                    setModalVisible(true);
                  }}
                >
                  <Info size={22} color="#007AFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaProvider>
      <View style={styles.mainContainer}>
        <StatusBar style="light" />
        
        {/* Background Accents */}
        <View style={[styles.glow, styles.glow1]} />
        <View style={[styles.glow, styles.glow2]} />
        
        <SafeAreaView style={styles.safeArea}>
          
          {/* Header */}
          <View style={styles.header}>
            {currentScreen === 'detail' ? (
              <TouchableOpacity onPress={navigateBack} style={styles.backButton}>
                <ArrowLeft color="#333" size={24} />
              </TouchableOpacity>
            ) : (
              <View style={styles.headerIcon}>
                <Github color="#000" size={32} />
              </View>
            )}
            <Text style={styles.title}>
              {currentScreen === 'home' ? 'Versiyonlar' : selectedRepo?.name}
            </Text>
            {currentScreen === 'home' && (
              <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
                <Plus color="#fff" size={24} />
              </TouchableOpacity>
            )}
          </View>

          {/* Screen Content */}
          <View style={styles.content}>
            {currentScreen === 'home' ? (
              repos.length === 0 ? (
                <View style={styles.emptyState}>
                  <RefreshCw color="rgba(255,255,255,0.1)" size={80} style={{ marginBottom: 20 }} />
                  <Text style={styles.emptyTitle}>Henüz Repo Yok</Text>
                  <Text style={styles.emptyDesc}>
                    Yeni bir proje eklemek için yukarıdaki + butonuna basın.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={repos}
                  renderItem={renderRepoItem}
                  keyExtractor={item => item.id}
                  contentContainerStyle={styles.listPadding}
                  showsVerticalScrollIndicator={false}
                />
              )
            ) : (
              <View style={{ flex: 1 }}>
                {loading ? (
                  <View style={styles.center}>
                    <ActivityIndicator size="large" color="#4A90E2" />
                  </View>
                ) : (
                  <FlatList
                    data={releases}
                    renderItem={renderReleaseItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.listPadding}
                    showsVerticalScrollIndicator={false}
                  />
                )}
              </View>
            )}
          </View>

          {/* Footer removed per user request */}
        </SafeAreaView>

        {/* Add Repo Modal */}
        {showAddModal && (
          <View style={styles.modalOverlay}>
            <BlurView intensity={90} tint="dark" style={styles.addModalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Yeni Proje Ekle</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <X color="#888" size={24} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.inputGroup}>
                <View style={styles.inputWrapper}>
                  <Search size={18} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="kullanıcı/proje"
                    placeholderTextColor="#666"
                    value={newRepoPath}
                    onChangeText={setNewRepoPath}
                    autoCapitalize="none"
                  />
                </View>

                <View style={[styles.inputWrapper, { marginTop: 12 }]}>
                  <Key size={18} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="GitHub Token (Özel repo için)"
                    placeholderTextColor="#666"
                    value={newToken}
                    onChangeText={setNewToken}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={handleAddRepo} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Kaydet</Text>
                )}
              </TouchableOpacity>
            </BlurView>
          </View>
        )}

        {/* Version Detail Modal */}
        <VersionModal 
          visible={modalVisible}
          version={selectedVersion}
          onClose={() => {
            setModalVisible(false);
            setSelectedVersion(null);
          }}
          onInstall={(v) => handleInstall(v, selectedRepo?.token)}
          downloading={downloadingId === selectedVersion?.id}
          token={selectedRepo?.token}
        />

      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7', // iOS Light background
  },
  safeArea: {
    flex: 1,
  },
  glow: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
  },
  glow1: {
    top: -100,
    left: -100,
  },
  glow2: {
    bottom: -100,
    right: -100,
    backgroundColor: 'rgba(52, 199,  green, 0.08)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 32,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#000',
    letterSpacing: -1.5,
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  content: {
    flex: 1,
  },
  listPadding: {
    paddingHorizontal: 24,
    paddingBottom: 60,
  },
  repoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    padding: 22,
    backgroundColor: '#fff',
    borderRadius: 24,
  },
  repoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  repoIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 18,
  },
  repoTextGroup: {
    flex: 1,
  },
  repoName: {
    color: '#000',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  repoOwner: {
    color: '#8E8E93',
    fontSize: 15,
    marginTop: 4,
    fontWeight: '500',
  },
  repoStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: '#007AFF20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginRight: 12,
  },
  badgeText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  deleteAction: {
    padding: 10,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 120,
  },
  emptyTitle: {
    color: '#000',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 12,
    letterSpacing: -1,
  },
  emptyDesc: {
    color: '#8E8E93',
    fontSize: 17,
    textAlign: 'center',
    maxWidth: '80%',
    lineHeight: 26,
    fontWeight: '500',
  },
  releaseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 18,
    paddingHorizontal: 22,
    backgroundColor: '#fff',
    borderRadius: 20,
  },
  versionLabel: {
    color: '#000',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -1,
  },
  releaseDate: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '600',
  },
  actionButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailButton: {
    backgroundColor: '#F2F2F7',
    marginLeft: 8,
  },
  downloadButton: {
    backgroundColor: '#34C759',
  },
  downloadProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C75920',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  progressText: {
    color: '#34C759',
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 10,
  },
  footer: {
    paddingVertical: 24,
    alignItems: 'center',
    opacity: 0.4,
  },
  footerText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addModalContainer: {
    width: width - 48,
    borderRadius: 40,
    padding: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -1,
  },
  inputGroup: {
    marginBottom: 32,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    height: 64,
    paddingHorizontal: 20,
  },
  inputIcon: {
    marginRight: 16,
  },
  textInput: {
    flex: 1,
    color: '#fff',
    fontSize: 17,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#fff',
    height: 64,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10,
  },
  saveButtonText: {
    color: '#000',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
