import React, { useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ActivityIndicator, 
  Animated,
  Alert
} from 'react-native';
import { 
  Swipeable,
  RectButton
} from 'react-native-gesture-handler';
import { 
  Download, 
  RefreshCw,
  Trash2,
  Info,
  Box
} from 'lucide-react-native';
import { GlassCard } from './GlassCard';

export const ReleaseItem = ({ 
  item, 
  isDarkMode, 
  theme, 
  cachedApks, 
  downloadingId, 
  selectedRepo, 
  workflowRuns, 
  progress, 
  handleInstall, 
  handleDeleteApk, 
  onHide,
  setSelectedVersion, 
  setModalVisible 
}) => {
  if (!item) return null;
  
  const uniqueName = `${item.version}_${item.apkAsset?.name}`;
  const isDownloaded = cachedApks[uniqueName];
  const isDownloading = downloadingId === item.id;

  // Check if there is an active build for this repo that might be this release
  const repoRuns = workflowRuns[selectedRepo?.id] || [];
  const activeRun = repoRuns.find(run => 
    (run.status === 'in_progress' || run.status === 'queued') && 
    (
      item.version === run.head_branch || 
      item.version === run.display_title || 
      (run.head_sha && item.notes?.includes(run.head_sha)) ||
      (run.head_branch && item.version.includes(run.head_branch))
    )
  );
  
  const isBuilding = !item.apkAsset && activeRun;

  // Pulse animation for Building state
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    if (isBuilding) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isBuilding]);

  const renderRightActions = (progressAnimatedValue, dragAnimatedValue) => {
    const trans = dragAnimatedValue.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.rightActionsContainer}>
        {/* Delete APK Action (if downloaded) */}
        {item.apkAsset && isDownloaded && (
          <RectButton 
            style={[styles.rightAction, { backgroundColor: theme.danger }]} 
            onPress={() => handleDeleteApk(item)}
          >
            <Animated.View style={{ transform: [{ scale: trans }] }}>
              <Trash2 size={24} color="#fff" />
            </Animated.View>
          </RectButton>
        )}
        
        {/* Hide Version Action */}
        <RectButton 
          style={[styles.rightAction, { backgroundColor: theme.subText }]} 
          onPress={() => onHide(item)}
        >
          <Animated.View style={{ transform: [{ scale: trans }] }}>
            <View style={{ alignItems: 'center' }}>
              <Trash2 size={24} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold', marginTop: 4 }}>GİZLE</Text>
            </View>
          </Animated.View>
        </RectButton>
      </View>
    );
  };

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={40}
    >
      <TouchableOpacity onPress={() => { setSelectedVersion(item); setModalVisible(true); }} activeOpacity={0.8}>
        <GlassCard isDarkMode={isDarkMode} style={[styles.releaseCard, { backgroundColor: theme.card, borderLeftWidth: isBuilding ? 4 : 1, borderLeftColor: isBuilding ? theme.accent : theme.border }]}>
          <Animated.View style={[styles.releaseContainer, isBuilding && { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.releaseLeft}>
              <Text style={[styles.versionLabel, { color: theme.text }]}>{item.version || 'Bilinmiyor'}</Text>
              <Text style={[styles.releaseDate, { color: theme.subText }]}>
                {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('tr-TR') : 'Yayınlanıyor...'}
                {isDownloaded && <Text style={{ color: theme.success, fontWeight: '900' }}> • İNDİRİLDİ</Text>}
                {isBuilding && <Text style={{ color: theme.accent, fontWeight: '900' }}> • DERLENİYOR</Text>}
              </Text>
            </View>
            <View style={styles.releaseRight}>
              {isDownloading ? (
                <View style={[styles.downloadProgressContainer, { backgroundColor: theme.accentBg }]}>
                  <ActivityIndicator size="small" color={theme.accent} />
                  <Text style={[styles.progressText, { color: theme.accent }]}>%{Math.round(progress * 100)}</Text>
                </View>
              ) : isBuilding ? (
                <View style={[styles.downloadProgressContainer, { backgroundColor: theme.accentBg, borderRadius: 20 }]}>
                  <RefreshCw size={14} color={theme.accent} style={{ marginRight: 6 }} />
                  <Text style={[styles.progressText, { color: theme.accent }]}>Derleniyor</Text>
                </View>
              ) : (
                <View style={styles.actionButtonGroup}>
                  {item.apkAsset ? (
                    <TouchableOpacity 
                      style={[
                        styles.actionButton, 
                        isDownloaded ? { backgroundColor: theme.accent } : { backgroundColor: theme.success }
                      ]}
                      onPress={() => handleInstall(item, selectedRepo?.token)}
                    >
                      {isDownloaded ? (
                        <Box size={20} color="#fff" />
                      ) : (
                        <Download size={20} color="#fff" />
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.actionButton, { backgroundColor: theme.iconBg }]}>
                       <RefreshCw size={18} color={theme.subText} />
                    </View>
                  )}
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.detailButton, { backgroundColor: theme.iconBg }]}
                    onPress={() => {
                      setSelectedVersion(item);
                      setModalVisible(true);
                    }}
                  >
                    <Info size={22} color={theme.accent} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Animated.View>
        </GlassCard>
      </TouchableOpacity>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  releaseCard: {
    marginBottom: 12,
    borderRadius: 20,
    padding: 0,
    overflow: 'hidden',
  },
  releaseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  releaseLeft: {
    flex: 1,
  },
  versionLabel: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  releaseDate: {
    fontSize: 13,
    fontWeight: '500',
  },
  releaseRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 6,
  },
  actionButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailButton: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  rightActionsContainer: {
    flexDirection: 'row',
    width: 160,
    height: '88%',
    marginBottom: 12,
  },
  rightAction: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    borderRadius: 20,
    marginLeft: 8,
  },
});
