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
import { PaymentSuccess } from './components/subscription/PaymentSuccess';

// 认证和同步组件
import { AuthProvider, useAuth, useRequireAuth } from './hooks/useAuth';
import { SyncProvider } from './hooks/useSync';
import { SubscriptionProvider } from './hooks/useSubscription';
import { LoginPage } from './components/auth/LoginPage';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { initializeSync } from './utils/simpleSync';

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

// 主应用内容组件（认证后显示）
function MainApp() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();
  const [syncInitialized, setSyncInitialized] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  useEffect(() => {
    // 当用户认证后初始化同步
    if (isAuthenticated && isInitialized && !syncInitialized) {
      initializeSync()
        .then(() => {
          console.log('✅ 同步系统初始化完成');
          setSyncInitialized(true);
        })
        .catch((error) => {
          console.warn('⚠️ 同步系统初始化失败:', error);
          // 同步失败不影响主应用使用
          setSyncInitialized(true);
        });
    }
  }, [isAuthenticated, isInitialized, syncInitialized]);

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
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/units" element={<UnitsPage />} />
          <Route path="/practice/:unitId" element={<PracticePage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
        </Routes>
      </Layout>
    </Router>
  );
}

// 认证守卫组件
function AuthGate() {
  const { isAuthenticated, needsAuth, isLoading } = useRequireAuth();
  const [appLoading, setAppLoading] = useState(false);

  // 显示加载状态
  if (isLoading || appLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <LoadingSpinner size="large" color="white" />
        <h2 style={{ margin: '1rem 0 0.5rem 0', fontSize: '2rem' }}>WordMate</h2>
        <p style={{ margin: 0, opacity: 0.9 }}>
          {isAuthenticated ? '正在加载您的学习数据...' : '正在初始化...'}
        </p>
      </div>
    );
  }

  // 显示登录页面
  if (needsAuth) {
    return (
      <LoginPage 
        onLogin={() => {
          setAppLoading(true);
          // 登录成功后会触发useEffect重新渲染
          setTimeout(() => setAppLoading(false), 1000);
        }} 
      />
    );
  }

  // 显示主应用
  return <MainApp />;
}

// 主应用入口
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <GlobalStyle />
        <AuthProvider>
          <SubscriptionProvider>
            <SyncProvider>
              <AuthGate />
            </SyncProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
