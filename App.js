import 'punycode';
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  UIManager,
  RefreshControl,
  BackHandler,
  Animated
} from 'react-native';
import { 
  GestureHandlerRootView, 
  Swipeable,
  RectButton
} from 'react-native-gesture-handler';
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
  Info,
  Sun,
  Moon,
  Box
} from 'lucide-react-native';

// Services & Components
import { storageService } from './services/storageService';
import { fetchReleases, fetchWorkflowRuns } from './services/githubService';
import { downloadAndInstallApk, isApkDownloaded, deleteApk } from './services/updateService';
import { registerBackgroundTasks } from './services/backgroundService';
import { sendLocalNotification, requestNotificationPermissions } from './services/notificationService';
import * as Notifications from 'expo-notifications';
import { GlassCard } from './components/GlassCard';
import { VersionModal } from './components/VersionModal';
import { ReleaseItem } from './components/ReleaseItem';

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
  const [repoToDelete, setRepoToDelete] = useState(null);
  
  // Data State
  const [repos, setRepos] = useState([]);
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [cachedApks, setCachedApks] = useState({}); // { uniqueName: true }
  const [workflowRuns, setWorkflowRuns] = useState({}); // { repoId: lastRuns }
  const [refreshing, setRefreshing] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Theme Config
  const theme = {
    bg: isDarkMode ? '#000000' : '#F2F2F7',
    card: isDarkMode ? 'rgba(28, 28, 30, 0.7)' : 'rgba(255, 255, 255, 0.95)',
    text: isDarkMode ? '#FFFFFF' : '#000000',
    subText: isDarkMode ? '#8E8E93' : '#636366',
    accent: '#007AFF', // iOS Blue
    accentBg: isDarkMode ? 'rgba(0, 122, 255, 0.2)' : 'rgba(0, 122, 255, 0.1)',
    danger: '#FF3B30',
    success: '#34C759',
    iconBg: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    border: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  };

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
    await requestNotificationPermissions();
  };

  // Hardware Back Button Handling
  useEffect(() => {
    const backAction = () => {
      if (modalVisible) {
        setModalVisible(false);
        return true;
      }
      if (repoToDelete) {
        setRepoToDelete(null);
        return true;
      }
      if (showAddModal) {
        setShowAddModal(false);
        return true;
      }
      if (currentScreen === 'detail') {
        navigateBack();
        return true;
      }
      return false; // Exit app
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [currentScreen, modalVisible, showAddModal]);

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
        const uniqueName = `${rel.version}_${rel.apkAsset.name}`;
        status[uniqueName] = await isApkDownloaded(uniqueName);
      }
    }
    setCachedApks(status);
  };

  const checkAllForUpdates = async (repoList) => {
    for (const repo of repoList) {
      try {
        // Build Status Tracking
        const runs = await fetchWorkflowRuns(repo.owner, repo.name, repo.token);
        if (runs.length > 0) {
          const latestRun = runs[0];
          const prevRuns = workflowRuns[repo.id] || [];
          const prevRun = prevRuns[0];

          // Notify on status change ( queued -> in_progress -> completed )
          if (prevRun && (latestRun.status !== prevRun.status || latestRun.conclusion !== prevRun.conclusion)) {
            let title = `Build Durumu: ${repo.name}`;
            let body = `Durum değişti: ${latestRun.status === 'in_progress' ? 'İşleniyor' : latestRun.status}`;
            
            if (latestRun.conclusion === 'success') {
              body = 'Build başarıyla tamamlandı! APK indirilebilir.';
              // If we are in detail view of THIS repo, refresh releases automatically
              if (currentScreen === 'detail' && selectedRepo?.id === repo.id) {
                handleSelectRepo(repo);
              }
            } else if (latestRun.conclusion === 'failure') {
              body = 'Build başarısız oldu.';
            } else if (latestRun.status === 'in_progress') {
              body = 'Build işlemi başladı...';
            }
            
            await sendLocalNotification(title, body);
          }
          
          setWorkflowRuns(prev => ({ ...prev, [repo.id]: runs }));
        }

        const results = await fetchReleases(repo.owner, repo.name, repo.token);
        if (results.length > 0) {
          const latest = results[0];
          if (latest.version !== repo.lastVersion) {
            console.log(`Update found for ${repo.path}: ${latest.version}`);
            await sendLocalNotification('Yeni Versiyon!', `${repo.name} için ${latest.version} yayınlandı.`);
            await storageService.updateRepoVersion(repo.id, latest.version);
            setRepos(await storageService.getRepos());
          }
        }
      } catch (err) {
        console.error(`Status check failed for ${repo.path}`, err);
      }
    }
  };

  // Polling for build status (every 1 minute when app is active)
  useEffect(() => {
    if (repos.length === 0) return;
    
    const interval = setInterval(() => {
      checkAllForUpdates(repos);
    }, 60000);
    return () => clearInterval(interval);
  }, [repos]); // Only restart interval if repos list changes

  // Refresh local cache status when releases change
  useEffect(() => {
    checkLocalFiles();
  }, [releases]);

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

  const handleDeleteRepo = async (repo) => {
    setRepoToDelete(repo);
  };

  const confirmDeleteRepo = async () => {
    if (!repoToDelete) return;
    const updated = await storageService.removeRepo(repoToDelete.id);
    setRepos(updated);
    setRepoToDelete(null);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const handleSelectRepo = async (repo) => {
    setSelectedRepo(repo);
    setLoading(true);
    setCurrentScreen('detail');
    if (Platform.OS === 'ios' || (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental)) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    
    try {
      const runs = await fetchWorkflowRuns(repo.owner, repo.name, repo.token);
      setWorkflowRuns(prev => ({ ...prev, [repo.id]: runs }));

      const releaseResults = await fetchReleases(repo.owner, repo.name, repo.token);
      
      // Merge active builds into releases if they don't have a release yet
      const mergedReleases = [...releaseResults];
      
      const activeRuns = runs.filter(run => 
        (run.status === 'in_progress' || run.status === 'queued')
      );

      for (const run of activeRuns) {
        // Find if this run already has a release in the list
        // It could be matched by branch name or display title
        const runIdent = run.display_title || run.head_branch || '';
        const alreadyHasRelease = releaseResults.some(rel => 
          rel.version === runIdent || rel.version === run.head_branch
        );

        if (!alreadyHasRelease && runIdent) {
          mergedReleases.unshift({
            id: `run-${run.id}`,
            version: runIdent,
            name: run.display_title || 'Yeni Build',
            notes: `GitHub Actions Build: ${run.html_url}\nSHA: ${run.head_sha}`,
            publishedAt: null, // Indicates it's not a release yet
            repoOwner: repo.owner,
            repoName: repo.name,
            isDraft: true,
            workflowRun: run
          });
        }
      }

      // Filter out hidden versions
      const hiddenOnes = repo.hiddenVersions || [];
      const finalReleases = mergedReleases.filter(rel => !hiddenOnes.includes(rel.id.toString()) && !hiddenOnes.includes(rel.version));

      setReleases(finalReleases);
      
      if (releaseResults.length > 0) {
        await storageService.updateRepoVersion(repo.id, releaseResults[0].version);
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
      const uniqueName = `${version.version}_${asset.name}`;
      
      await downloadAndInstallApk(
        downloadUrl,
        uniqueName,
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

  const handleDeleteApk = async (item) => {
    if (!item.apkAsset) return;
    const uniqueName = `${item.version}_${item.apkAsset.name}`;
    const deleted = await deleteApk(uniqueName);
    if (deleted) {
      checkLocalFiles();
    }
  };

  const handleHideVersion = async (version) => {
    if (!selectedRepo || !version) return;
    
    try {
      // Use version ID or tag as identifier
      const versionId = version.id.toString();
      const updatedRepos = await storageService.hideVersion(selectedRepo.id, versionId);
      
      // Update local state
      setRepos(updatedRepos);
      const updatedRepo = updatedRepos.find(r => r.id === selectedRepo.id);
      setSelectedRepo(updatedRepo);
      
      // Filter the current releases state immediately for a snapier UI
      setReleases(prev => prev.filter(r => r.id.toString() !== versionId));
      
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch (err) {
      Alert.alert('Hata', 'Versiyon gizlenemedi.');
    }
  };

  const navigateBack = () => {
    setCurrentScreen('home');
    setReleases([]);
    setSelectedRepo(null);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (currentScreen === 'home') {
      await loadRepos();
    } else {
      await handleSelectRepo(selectedRepo);
    }
    setRefreshing(false);
  };

  // Renderers
  const renderRepoItem = ({ item }) => (
    <TouchableOpacity onPress={() => handleSelectRepo(item)} activeOpacity={0.7}>
      <GlassCard isDarkMode={isDarkMode} style={[styles.repoCard, { backgroundColor: theme.card }]}>
        <View style={styles.repoInfo}>
          <View style={[styles.repoIconContainer, { backgroundColor: theme.iconBg }]}>
            <Github color={theme.text} size={24} />
          </View>
          <View style={styles.repoTextGroup}>
            <Text style={[styles.repoName, { color: theme.text }]}>{item.name}</Text>
            <Text style={[styles.repoOwner, { color: theme.subText }]}>{item.owner}</Text>
          </View>
        </View>
        <View style={styles.repoStatus}>
          {item.lastVersion && (
            <View style={[styles.badge, { backgroundColor: theme.accentBg }]}>
              <Text style={[styles.badgeText, { color: theme.accent }]}>{item.lastVersion}</Text>
            </View>
          )}
          <TouchableOpacity onPress={() => handleDeleteRepo(item)} style={[styles.deleteAction, { backgroundColor: theme.iconBg }]}>
            <Trash2 size={18} color={theme.subText} />
          </TouchableOpacity>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );

  const renderReleaseItem = ({ item }) => (
    <ReleaseItem 
      item={item}
      isDarkMode={isDarkMode}
      theme={theme}
      cachedApks={cachedApks}
      downloadingId={downloadingId}
      selectedRepo={selectedRepo}
      workflowRuns={workflowRuns}
      progress={progress}
      handleInstall={handleInstall}
      onHide={handleHideVersion}
      setSelectedVersion={setSelectedVersion}
      setModalVisible={setModalVisible}
    />
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={[styles.mainContainer, { backgroundColor: theme.bg }]}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        
        {/* Background Accents */}
        <View style={[styles.glow, styles.glow1, { backgroundColor: theme.accentBg }]} />
        <View style={[styles.glow, styles.glow2, { backgroundColor: isDarkMode ? 'rgba(52, 199, 89, 0.1)' : 'rgba(52, 199, 89, 0.05)' }]} />
        
        <SafeAreaView style={styles.safeArea}>
          
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {currentScreen === 'detail' ? (
                <TouchableOpacity onPress={navigateBack} style={[styles.backButton, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <ArrowLeft color={theme.text} size={24} />
                </TouchableOpacity>
              ) : (
                <View style={[styles.headerIcon, { backgroundColor: theme.iconBg, borderColor: theme.border }]}>
                  <Github color={theme.text} size={32} />
                </View>
              )}
            </View>

            <View style={styles.headerCenter}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                {currentScreen === 'home' ? 'Versiyonlar' : selectedRepo?.name}
              </Text>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity 
                style={[styles.themeToggle, { backgroundColor: theme.iconBg }]} 
                onPress={() => setIsDarkMode(!isDarkMode)}
              >
                {isDarkMode ? <Sun color={theme.accent} size={22} /> : <Moon color={theme.accent} size={22} />}
              </TouchableOpacity>
              {currentScreen === 'home' && (
                <TouchableOpacity style={[styles.addButton, { backgroundColor: theme.text }]} onPress={() => setShowAddModal(true)}>
                  <Plus color={theme.bg} size={24} />
                </TouchableOpacity>
              )}
            </View>
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
                  refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
                  }
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
                    refreshControl={
                      <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
                    }
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
          isDarkMode={isDarkMode}
          onClose={() => {
            setModalVisible(false);
            setSelectedVersion(null);
          }}
          onInstall={(v) => handleInstall(v, selectedRepo?.token)}
          onDeleteApk={(v) => handleDeleteApk(v)}
          onHide={(v) => handleHideVersion(v)}
          downloaded={selectedVersion ? cachedApks[`${selectedVersion.version}_${selectedVersion.apkAsset?.name}`] : false}
          downloading={downloadingId === selectedVersion?.id}
          token={selectedRepo?.token}
        />
        {/* Repo Delete Confirmation Modal */}
        {repoToDelete && (
          <View style={[styles.modalOverlay, { zIndex: 2000 }]}>
            <BlurView intensity={30} tint={isDarkMode ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <View style={[styles.confirmDialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
               <View style={[styles.confirmIconBox, { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}>
                  <Trash2 size={32} color={theme.danger} />
               </View>
               <Text style={[styles.confirmTitle, { color: theme.text }]}>Projeyi Kaldır</Text>
               <Text style={[styles.confirmDesc, { color: theme.subText }]}>
                 <Text style={{ fontWeight: 'bold' }}>{repoToDelete.name}</Text> projesini listenizden kaldırmak istediğinize emin misiniz?
               </Text>
               
               <View style={styles.confirmActions}>
                  <TouchableOpacity 
                    style={[styles.confirmBtn, { backgroundColor: theme.iconBg }]}
                    onPress={() => setRepoToDelete(null)}
                  >
                    <Text style={[styles.confirmBtnText, { color: theme.text }]}>İptal</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.confirmBtn, { backgroundColor: theme.danger }]}
                    onPress={confirmDeleteRepo}
                  >
                    <Text style={[styles.confirmBtnText, { color: '#fff' }]}>Evet, Sil</Text>
                  </TouchableOpacity>
               </View>
            </View>
          </View>
        )}
      </View>
    </SafeAreaProvider>
  </GestureHandlerRootView>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerLeft: {
    width: 60,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    width: 110,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  themeToggle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -1,
    textAlign: 'center',
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  content: {
    flex: 1,
  },
  listPadding: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  repoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  repoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  repoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  repoTextGroup: {
    flex: 1,
  },
  repoName: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  repoOwner: {
    fontSize: 14,
    marginTop: 2,
    fontWeight: '500',
  },
  repoStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  deleteAction: {
    padding: 8,
    borderRadius: 10,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 120,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  emptyDesc: {
    fontSize: 16,
    textAlign: 'center',
    maxWidth: '75%',
    lineHeight: 24,
    fontWeight: '500',
  },
  releaseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  versionLabel: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  confirmDialog: {
    width: '85%',
    borderRadius: 32,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 20,
  },
  confirmIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  confirmTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  confirmDesc: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  confirmActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontWeight: '700',
    fontSize: 16,
  },
  releaseDate: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '600',
  },
  actionButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailButton: {
    marginLeft: 8,
  },
  downloadProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 8,
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
  rightAction: {
    alignItems: 'center',
    flexDirection: 'row',
    backgroundColor: '#dd2c00',
    flex: 1,
    justifyContent: 'flex-end',
    paddingRight: 30,
    borderRadius: 20,
    marginBottom: 12,
  },
  releaseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
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
