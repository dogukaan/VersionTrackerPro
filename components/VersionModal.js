import React, { useState, useEffect } from 'react';
import { Modal, StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Dimensions } from 'react-native';
import { X, Download, Box, FileText, GitCommit, Clock, User, Trash2 } from 'lucide-react-native';
import { fetchFileContent, fetchCommits } from '../services/githubService';

import MarkdownRenderer from './MarkdownRenderer';

const { height } = Dimensions.get('window');

export const VersionModal = ({ visible, version, onClose, onInstall, onDeleteApk, onHide, downloaded, downloading, token, isDarkMode }) => {
  const [fullNotes, setFullNotes] = useState('');
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(false);

  const themeByMode = {
    bg: isDarkMode ? '#1C1C1E' : '#FFFFFF',
    text: isDarkMode ? '#FFFFFF' : '#000000',
    subText: isDarkMode ? '#8E8E93' : '#636366',
    accent: '#007AFF',
    danger: '#FF3B30',
    iconBg: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F2F2F7',
    border: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    card: isDarkMode ? '#2C2C2E' : '#FFFFFF',
    overlay: isDarkMode ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)',
  };

  useEffect(() => {
    if (visible && version) {
      const isAutoNote = version.notes?.includes('Full Changelog');
      const hasNoNotes = !version.notes || version.notes.trim().length < 10;

      if (isAutoNote || hasNoNotes) {
        loadRepoChangelog();
      } else {
        setFullNotes(version.notes);
      }
    }
  }, [visible, version]);

  const loadRepoChangelog = async () => {
    setLoading(true);
    
    // First, always fetch recent commits for this tag/version to be sure
    const recentCommits = await fetchCommits(version.repoOwner, version.repoName, version.version, token);
    setCommits(recentCommits);

    // Try common names for CHANGELOG.md if notes are generic
    const files = ['CHANGELOG.md', 'changelog.md', 'CHANGES.md'];
    for (const file of files) {
      const content = await fetchFileContent(version.repoOwner, version.repoName, file, token);
      if (content) {
        setFullNotes(content);
        setLoading(false);
        return;
      }
    }
    setLoading(false);
  };


  if (!version) return null;

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        {/* Main Content Modal */}
        <View style={[styles.modalBlur, { backgroundColor: themeByMode.bg, borderColor: themeByMode.border }]}>
          <View style={styles.modalView}>
            <View style={styles.header}>
              <View style={styles.titleGroup}>
                <Text style={[styles.versionTag, { color: themeByMode.text }]}>{version.version}</Text>
                <Text style={[styles.releaseName, { color: themeByMode.subText }]}>{version.name}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: themeByMode.iconBg }]}>
                <X color={themeByMode.text} size={24} />
              </TouchableOpacity>
            </View>

            {/* Added paddingBottom to prevent hiding content behind floating card */}
            <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
              <View style={styles.changelogHeader}>
                <FileText size={16} color={themeByMode.subText} />
                <Text style={[styles.changelogTitle, { color: themeByMode.subText }]}>DEĞİŞİKLİK GÜNLÜĞÜ</Text>
              </View>
              
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={themeByMode.accent} />
                  <Text style={[styles.loadingText, { color: themeByMode.accent }]}>Veriler getiriliyor...</Text>
                </View>
              ) : (
                <>
                  {fullNotes ? (
                    <MarkdownRenderer isDarkMode={isDarkMode}>
                      {fullNotes}
                    </MarkdownRenderer>
                  ) : null}

                  {commits.length > 0 && (
                    <View style={styles.commitsContainer}>
                      <View style={[styles.changelogHeader, { marginTop: 20 }]}>
                        <GitCommit size={16} color={themeByMode.subText} />
                        <Text style={[styles.changelogTitle, { color: themeByMode.subText }]}>SON DEĞİŞİKLİKLER (COMMITS)</Text>
                      </View>
                      {commits.map((commit, index) => (
                        <View key={index} style={styles.commitItem}>
                          <View style={[styles.commitDot, { backgroundColor: themeByMode.accent }]} />
                          <View style={styles.commitContent}>
                            <Text style={[styles.commitMessage, { color: themeByMode.text }]} numberOfLines={2}>
                              {commit.message}
                            </Text>
                            <View style={styles.commitMeta}>
                              <View style={[styles.metaBadge, { backgroundColor: themeByMode.iconBg }]}>
                                <User size={10} color={themeByMode.subText} />
                                <Text style={[styles.metaText, { color: themeByMode.subText }]}>{commit.author}</Text>
                              </View>
                              <View style={[styles.metaBadge, { backgroundColor: themeByMode.iconBg }]}>
                                <Clock size={10} color={themeByMode.subText} />
                                <Text style={[styles.metaText, { color: themeByMode.subText }]}>{commit.date ? new Date(commit.date).toLocaleDateString('tr-TR') : 'Tarih Yok'}</Text>
                              </View>
                              <View style={[styles.metaBadge, { backgroundColor: themeByMode.iconBg }]}>
                                <Text style={[styles.metaText, { color: themeByMode.accent, fontFamily: 'monospace' }]}>{commit.sha}</Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                  
                  {!fullNotes && commits.length === 0 && (
                    <Text style={[styles.changelogText, { color: themeByMode.text }]}>Bu sürüm için detaylı not veya commit bulunamadı.</Text>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>

        {/* Floating Action Card */}
        <View style={[styles.floatingCard, { backgroundColor: themeByMode.card, borderColor: themeByMode.border }]}>
            {/* Left side: Commits and info */}
            <View style={styles.floatingInfo}>
              <View style={styles.infoRowContainer}>
                <View style={[styles.floatingBadge, { backgroundColor: themeByMode.iconBg }]}>
                  <GitCommit size={14} color={themeByMode.subText} />
                  <Text style={[styles.floatingBadgeText, { color: themeByMode.subText }]}>{commits.length} Değişiklik</Text>
                </View>
                <View style={[styles.floatingBadge, { backgroundColor: themeByMode.iconBg }]}>
                  <Box size={14} color={themeByMode.subText} />
                  <Text style={[styles.floatingBadgeText, { color: themeByMode.subText }]}>{version.apkAsset?.size ? `${Math.round(version.apkAsset.size / 1024 / 1024)} MB` : 'Bilinmiyor'}</Text>
                </View>
              </View>
            </View>

            {/* Right side: Actions */}
            <View style={styles.floatingActions}>

               {/* Delete Downloaded APK Button */}
               {downloaded && !downloading && (
                  <TouchableOpacity 
                    style={[styles.floatingActionBtn, { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}
                    onPress={() => onDeleteApk(version)}
                  >
                    <Trash2 size={20} color={themeByMode.danger} />
                  </TouchableOpacity>
               )}

               {/* Install / Download Button */}
               <TouchableOpacity 
                  style={[styles.installButton, downloading && styles.disabledButton]}
                  onPress={() => onInstall(version)}
                  disabled={downloading}
                >
                  {downloading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Download size={20} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={styles.installButtonText}>{downloaded ? 'Yükle' : 'İndir'}</Text>
                    </>
                  )}
                </TouchableOpacity>
            </View>
        </View>
      </View>
    </Modal>
  );
};

const getMarkdownStyles = (isDarkMode) => ({
  body: {
    color: isDarkMode ? '#FFFFFF' : '#000000',
    fontSize: 16,
    lineHeight: 24,
  },
  heading1: { color: '#007AFF', fontWeight: '900', marginVertical: 10 },
  heading2: { color: isDarkMode ? '#FFFFFF' : '#000000', fontWeight: '800', marginVertical: 8 },
  link: { color: '#007AFF', textDecorationLine: 'underline' },
  strong: { fontWeight: '800', color: isDarkMode ? '#FFFFFF' : '#000000' },
  bullet_list: { color: isDarkMode ? '#FFFFFF' : '#000000' },
  list_item: { color: isDarkMode ? '#FFFFFF' : '#000000', marginVertical: 4 },
});

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalBlur: {
    width: '94%',
    height: '75%',
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 10,
    marginBottom: 80,
  },
  modalView: {
    padding: 28,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  titleGroup: {
    flex: 1,
  },
  versionTag: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1.5,
  },
  releaseName: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  changelogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  changelogTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginLeft: 8,
  },
  changelogText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  
  /* Floating Card Styles */
  floatingCard: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 20,
    width: '90%',
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 15,
  },
  floatingInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  infoRowContainer: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-start',
  },
  floatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
  },
  floatingBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  floatingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  floatingActionBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  installButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 16,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  disabledButton: {
    backgroundColor: '#E5E5EA',
  },
  installButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: -0.5,
  },
  
  /* Confirmation Overlay Styles */
  confirmationOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  confirmationCard: {
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
  confirmIconWrapper: {
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
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  confirmCancelText: {
    fontWeight: '700',
    fontSize: 16,
  },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  confirmDeleteText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  
  commitsContainer: {
    paddingBottom: 20,
  },
  commitItem: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingLeft: 4,
  },
  commitDot: {
    width: 2,
    marginRight: 16,
    borderRadius: 1,
    opacity: 0.3,
  },
  commitContent: {
    flex: 1,
  },
  commitMessage: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 6,
  },
  commitMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
