import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'styled-components';
import { useEffect, useState } from 'react';

// 页面组件
import HomePage from './pages/HomePage';
import UnitsPage from './pages/UnitsPage';
import PracticePage from './pages/PracticePage';
import ProgressPage from './pages/ProgressPage';
import SettingsPage from './pages/SettingsPage';

// 服务
import { DatabaseService } from './services/database';
import { VocabularyData } from './types/vocabulary';

// 样式
import { GlobalStyle, theme } from './styles/theme';
import Layout from './components/Layout';

// 创建 React Query 客户端
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5分钟
      retry: 2,
    },
  },
});

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // 加载词汇数据
      const vocabularyDataResponse = await fetch('/grade6_B_enhanced.json');
      if (!vocabularyDataResponse.ok) {
        throw new Error('无法加载词汇数据');
      }
      
      const vocabularyData: VocabularyData = await vocabularyDataResponse.json();
      
      // 初始化数据库
      await DatabaseService.initializeVocabularyData(vocabularyData);
      
      setIsInitialized(true);
      console.log('应用初始化完成');
    } catch (error) {
      console.error('应用初始化失败:', error);
      setError(error instanceof Error ? error.message : '初始化失败');
    }
  };

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <h2>初始化失败</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>
          重新加载
        </button>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div>正在初始化应用...</div>
        <div>请稍候</div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <GlobalStyle />
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/units" element={<UnitsPage />} />
              <Route path="/practice/:unitId" element={<PracticePage />} />
              <Route path="/progress" element={<ProgressPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Layout>
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
