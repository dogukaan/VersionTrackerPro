import React from 'react';
import { Text, StyleSheet } from 'react-native';

const MarkdownRenderer = ({ children }) => {
  // Simple regex to make markdown more readable on web without a heavy library
  const formattedText = children
    .replace(/^### (.*$)/gim, '$1')
    .replace(/^## (.*$)/gim, '$1')
    .replace(/^# (.*$)/gim, '$1')
    .replace(/\*\*(.*)\*\*/gim, '$1')
    .replace(/\*(.*)\*/gim, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/gim, '$1 ($2)');

  return <Text style={styles.text}>{formattedText}</Text>;
};

const styles = StyleSheet.create({
  text: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  }
});

export default MarkdownRenderer;
