import React, { useState, useEffect } from 'react';
import { Modal, StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
// expo-blur removed for Android stability
import { X, Download, Box, FileText, GitCommit, Clock, User, Trash2 } from 'lucide-react-native';
import { fetchFileContent, fetchCommits } from '../services/githubService';

import MarkdownRenderer from './MarkdownRenderer';

export const VersionModal = ({ visible, version, onClose, onInstall, onDeleteApk, downloaded, downloading, token, isDarkMode }) => {
  const [fullNotes, setFullNotes] = useState('');
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(false);

  const themeByMode = {
    bg: isDarkMode ? '#000000' : '#FFFFFF',
    text: isDarkMode ? '#FFFFFF' : '#000000',
    subText: isDarkMode ? '#8E8E93' : '#636366',
    accent: '#007AFF',
    iconBg: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    border: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
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
    setFullNotes(version.notes || '');
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

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.changelogHeader}>
                <FileText size={16} color={themeByMode.subText} />
                <Text style={[styles.changelogTitle, { color: themeByMode.subText }]}>DEĞİŞİKLİK GÜNLÜĞÜ</Text>
              </View>
              
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#007AFF" />
                  <Text style={styles.loadingText}>Veriler getiriliyor...</Text>
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
                          <View style={styles.commitDot} />
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

            <View style={[styles.footer, { borderTopColor: themeByMode.border }]}>
              <View style={[styles.infoRow, { backgroundColor: themeByMode.iconBg }]}>
                <Box size={16} color={themeByMode.subText} />
                <Text style={[styles.infoText, { color: themeByMode.subText }]}>{version.apkAsset?.size ? `${Math.round(version.apkAsset.size / 1024 / 1024)} MB` : 'Bilinmiyor'}</Text>
              </View>
              
              <View style={styles.footerActions}>
                {downloaded && !downloading && (
                  <TouchableOpacity 
                    style={[styles.deleteButton, { borderRightWidth: 1, borderRightColor: themeByMode.border }]}
                    onPress={() => onDeleteApk(version)}
                  >
                    <Trash2 size={20} color="#FF3B30" />
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity 
                  style={[styles.installButton, downloading && styles.disabledButton]}
                  onPress={() => onInstall(version)}
                  disabled={downloading}
                >
                  {downloading ? (
                    <Text style={styles.installButtonText}>İndiriliyor...</Text>
                  ) : (
                    <>
                      <Download size={20} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.installButtonText}>{downloaded ? 'Yükle' : 'İndir'}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
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
    maxHeight: '85%',
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 10,
  },
  modalView: {
    padding: 28,
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
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    maxHeight: 450,
    marginBottom: 24,
  },
  changelogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  changelogTitle: {
    color: '#8E8E93',
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
    color: '#007AFF',
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  installButton: {
    backgroundColor: '#007AFF', // Reverting to Blue for Premium Light
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 20,
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
    fontSize: 17,
    letterSpacing: -0.5,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteButton: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#FF3B3015',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commitsContainer: {
    paddingBottom: 10,
  },
  commitItem: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingLeft: 4,
  },
  commitDot: {
    width: 2,
    backgroundColor: '#007AFF',
    marginRight: 16,
    borderRadius: 1,
    opacity: 0.2,
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
    backgroundColor: '#F2F2F7',
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
