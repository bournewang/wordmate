import React from 'react';
import { Container } from '../styles/theme';

const SettingsPage: React.FC = () => {
  return (
    <Container>
      <div style={{ textAlign: 'center', padding: '64px 0' }}>
        <h1>设置</h1>
        <p>用户设置功能正在开发中...</p>
        <p>即将支持：音频设置、学习偏好、数据同步等功能</p>
      </div>
    </Container>
  );
};

export default SettingsPage;
