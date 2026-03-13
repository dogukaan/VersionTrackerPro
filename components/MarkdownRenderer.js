import React from 'react';
import { StyleSheet, Platform } from 'react-native';
import Markdown from 'react-native-markdown-display';

const MarkdownRenderer = ({ children, isDarkMode }) => {
  const styles = getStyles(isDarkMode);
  return <Markdown style={styles}>{children}</Markdown>;
};

const getStyles = (isDarkMode) => StyleSheet.create({
  body: {
    color: isDarkMode ? '#FFFFFF' : '#000000',
    fontSize: 16,
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'Inter' : 'sans-serif',
  },
  heading1: {
    color: '#007AFF',
    fontWeight: '900',
    marginVertical: 12,
    fontSize: 24,
    letterSpacing: -1,
  },
  heading2: {
    color: isDarkMode ? '#FFFFFF' : '#000000',
    fontWeight: '800',
    marginVertical: 10,
    fontSize: 20,
    letterSpacing: -0.5,
  },
  link: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  strong: {
    fontWeight: '800',
    color: isDarkMode ? '#FFFFFF' : '#1C1C1E',
  },
  bullet_list: {
    marginVertical: 8,
  },
  list_item: {
    marginVertical: 4,
  },
  bullet_list_icon: {
    color: '#007AFF',
    fontSize: 20,
    lineHeight: 24,
  },
});

export default MarkdownRenderer;
