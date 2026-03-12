import React from 'react';
import Markdown from 'react-native-markdown-display';

const MarkdownRenderer = ({ children, style }) => {
  return (
    <Markdown style={style}>
      {children}
    </Markdown>
  );
};

export default MarkdownRenderer;
