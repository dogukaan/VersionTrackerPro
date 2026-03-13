import { Text } from 'react-native';

const MarkdownRenderer = ({ children, style }) => {
  return (
    <Text style={style?.body || { color: '#fff' }}>
      {children}
    </Text>
  );
};

export default MarkdownRenderer;
