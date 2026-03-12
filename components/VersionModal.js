import React, { useState, useEffect } from 'react';
import { Modal, StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { X, Download, Box, FileText } from 'lucide-react-native';
import Markdown from 'react-native-markdown-display';
import { fetchFileContent } from '../services/githubService';

export const VersionModal = ({ visible, version, onClose, onInstall, downloading, token }) => {
  const [fullNotes, setFullNotes] = useState('');
  const [loading, setLoading] = useState(false);

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
    // Try common names
    const files = ['CHANGELOG.md', 'changelog.md', 'CHANGES.md'];
    for (const file of files) {
      const content = await fetchFileContent(version.repoOwner, version.repoName, file, token);
      if (content) {
        setFullNotes(content);
        setLoading(false);
        return;
      }
    }
    setFullNotes(version.notes || 'Bu sürüm için detaylı not bırakılmamış.');
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
        <BlurView intensity={80} tint="dark" style={styles.modalBlur}>
          <View style={styles.modalView}>
            <View style={styles.header}>
              <View style={styles.titleGroup}>
                <Text style={styles.versionTag}>{version.version}</Text>
                <Text style={styles.releaseName}>{version.name}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X color="#fff" size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.changelogHeader}>
                <FileText size={16} color="rgba(255,255,255,0.5)" />
                <Text style={styles.changelogTitle}>DEĞİŞİKLİK GÜNLÜĞÜ</Text>
              </View>
              
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#007AFF" />
                  <Text style={styles.loadingText}>CHANGELOG.md getiriliyor...</Text>
                </View>
              ) : (
                <Markdown style={markdownStyles}>
                  {fullNotes}
                </Markdown>
              )}
            </ScrollView>

            <View style={styles.footer}>
              <View style={styles.infoRow}>
                <Box size={16} color="#888" />
                <Text style={styles.infoText}>{Math.round(version.apkAsset.size / 1024 / 1024)} MB</Text>
              </View>
              
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
                    <Text style={styles.installButtonText}>Yükle</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
};

const markdownStyles = {
  body: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
  heading1: { color: '#007AFF', fontWeight: '900', marginVertical: 10 },
  heading2: { color: '#fff', fontWeight: '800', marginVertical: 8 },
  link: { color: '#007AFF', textDecorationLine: 'underline' },
  strong: { fontWeight: '800', color: '#fff' },
  bullet_list: { color: '#fff' },
  list_item: { color: '#fff', marginVertical: 4 },
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalBlur: {
    width: '90%',
    maxHeight: '85%',
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
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
    color: '#007AFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1.5,
  },
  releaseName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginLeft: 8,
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
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  infoText: {
    color: '#aaa',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  installButton: {
    backgroundColor: '#34C759',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 20,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  disabledButton: {
    backgroundColor: '#222',
    opacity: 0.5,
  },
  installButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: -0.5,
  },
});
