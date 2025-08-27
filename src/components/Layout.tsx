import React, { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { 
  Home, 
  BookOpen, 
  BarChart3, 
  Settings, 
  Volume2,
  Menu,
  X,
  User,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const LayoutContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
`;

const Header = styled.header`
  background: ${({ theme }) => theme.colors.white};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  padding: ${({ theme }) => theme.spacing.md} 0;
  position: sticky;
  top: 0;
  z-index: 100;
`;

const HeaderContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.spacing.lg};
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: 0 ${({ theme }) => theme.spacing.md};
  }
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  
  h1 {
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: ${({ theme }) => theme.fontWeights.bold};
    color: ${({ theme }) => theme.colors.primary};
    margin: 0;
  }
`;

const MainContent = styled.main`
  flex: 1;
  display: flex;
  min-height: calc(100vh - 80px);
`;

const Sidebar = styled.aside<{ $isOpen: boolean }>`
  width: 250px;
  background: ${({ theme }) => theme.colors.backgroundSecondary};
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  padding: ${({ theme }) => theme.spacing.lg};
  
  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    z-index: 200;
    transform: translateX(${({ $isOpen }) => $isOpen ? '0' : '-100%'});
    transition: transform ${({ theme }) => theme.transitions.normal};
    box-shadow: ${({ $isOpen, theme }) => $isOpen ? theme.shadows.lg : 'none'};
  }
`;

const SidebarOverlay = styled.div<{ $isVisible: boolean }>`
  display: none;
  
  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    display: ${({ $isVisible }) => $isVisible ? 'block' : 'none'};
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    z-index: 190;
  }
`;

const SidebarHeader = styled.div`
  display: none;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  padding-bottom: ${({ theme }) => theme.spacing.md};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  
  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    display: flex;
  }
  
  h2 {
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: ${({ theme }) => theme.fontWeights.semibold};
    color: ${({ theme }) => theme.colors.primary};
    margin: 0;
  }
`;

const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: all ${({ theme }) => theme.transitions.fast};
  
  &:hover {
    background: ${({ theme }) => theme.colors.gray100};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

const Nav = styled.nav`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const NavLink = styled(Link)<{ $isActive: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ $isActive, theme }) => 
    $isActive ? theme.colors.primary : theme.colors.textSecondary};
  background: ${({ $isActive, theme }) => 
    $isActive ? theme.colors.primaryLight + '20' : 'transparent'};
  text-decoration: none;
  font-weight: ${({ $isActive, theme }) => 
    $isActive ? theme.fontWeights.medium : theme.fontWeights.normal};
  transition: all ${({ theme }) => theme.transitions.fast};
  
  &:hover {
    background: ${({ $isActive, theme }) => 
      $isActive ? theme.colors.primaryLight + '30' : theme.colors.gray100};
    color: ${({ theme }) => theme.colors.textPrimary};
    text-decoration: none;
  }
  
  svg {
    width: 20px;
    height: 20px;
  }
`;

const ContentArea = styled.div`
  flex: 1;
  padding: ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colors.background};
  
  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing.md};
  }
`;

const MobileMenuButton = styled.button`
  display: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: transparent;
  color: ${({ theme }) => theme.colors.textSecondary};
  transition: all ${({ theme }) => theme.transitions.fast};
  
  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    display: flex;
  }
  
  &:hover {
    background: ${({ theme }) => theme.colors.gray100};
    color: ${({ theme }) => theme.colors.textPrimary};
  }
`;

const UserSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

const UserProfile = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const UserButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.backgroundSecondary};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.fast};
  
  &:hover {
    background: ${({ theme }) => theme.colors.gray100};
    border-color: ${({ theme }) => theme.colors.primary};
  }
  
  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.xs};
  }
`;

const UserInfo = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  
  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    display: none;
  }
`;

const UserName = styled.span`
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.textPrimary};
  line-height: 1.2;
`;

const UserGrade = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: 1.2;
`;

const UserDropdown = styled.div<{ $isOpen: boolean }>`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: ${({ theme }) => theme.spacing.xs};
  background: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  box-shadow: ${({ theme }) => theme.shadows.lg};
  min-width: 200px;
  z-index: 100;
  display: ${({ $isOpen }) => $isOpen ? 'block' : 'none'};
  
  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    right: -${({ theme }) => theme.spacing.md};
    min-width: 180px;
  }
`;

const DropdownItem = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
  padding: ${({ theme }) => theme.spacing.md};
  background: transparent;
  border: none;
  color: ${({ theme }) => theme.colors.textPrimary};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  text-align: left;
  cursor: pointer;
  transition: background ${({ theme }) => theme.transitions.fast};
  
  &:first-child {
    border-radius: ${({ theme }) => theme.borderRadius.md} ${({ theme }) => theme.borderRadius.md} 0 0;
  }
  
  &:last-child {
    border-radius: 0 0 ${({ theme }) => theme.borderRadius.md} ${({ theme }) => theme.borderRadius.md};
  }
  
  &:only-child {
    border-radius: ${({ theme }) => theme.borderRadius.md};
  }
  
  &:hover {
    background: ${({ theme }) => theme.colors.gray50};
  }
  
  &.logout {
    color: ${({ theme }) => theme.colors.error};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    
    &:hover {
      background: rgba(255, 107, 107, 0.1);
    }
  }
  
  svg {
    width: 16px;
    height: 16px;
  }
`;

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const { user, logout, isAuthenticated } = useAuth();

  const navigation = [
    { name: '首页', href: '/', icon: Home },
    { name: '单元学习', href: '/units', icon: BookOpen },
    { name: '学习进度', href: '/progress', icon: BarChart3 },
    { name: '设置', href: '/settings', icon: Settings },
  ];

  const closeSidebar = () => setSidebarOpen(false);
  
  const handleLogout = async () => {
    setUserDropdownOpen(false);
    await logout();
  };
  
  const getGradeDisplayName = (grade: string) => {
    const gradeMap: Record<string, string> = {
      'grade3': '三年级',
      'grade4': '四年级',
      'grade5': '五年级',
      'grade6': '六年级',
      'junior': '初中',
      'senior': '高中'
    };
    return gradeMap[grade] || '六年级';
  };
  
  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => {
      if (userDropdownOpen) {
        setUserDropdownOpen(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [userDropdownOpen]);

  return (
    <LayoutContainer>
      <Header>
        <HeaderContent>
          <Logo>
            <Volume2 size={24} />
            <h1>词汇练习</h1>
          </Logo>
          
          <UserSection>
            {isAuthenticated && user && (
              <UserProfile>
                <UserButton
                  onClick={(e) => {
                    e.stopPropagation();
                    setUserDropdownOpen(!userDropdownOpen);
                  }}
                  aria-label="用户菜单"
                >
                  <User size={18} />
                  <UserInfo>
                    <UserName>{user.email || user.username}</UserName>
                    <UserGrade>{getGradeDisplayName(user.grade)}</UserGrade>
                  </UserInfo>
                  <ChevronDown size={16} />
                </UserButton>
                
                <UserDropdown $isOpen={userDropdownOpen}>
                  <DropdownItem
                    onClick={() => {
                      setUserDropdownOpen(false);
                      // Could navigate to profile page in the future
                    }}
                  >
                    <User size={16} />
                    查看资料
                  </DropdownItem>
                  <DropdownItem
                    className="logout"
                    onClick={handleLogout}
                  >
                    <LogOut size={16} />
                    退出登录
                  </DropdownItem>
                </UserDropdown>
              </UserProfile>
            )}
            
            <MobileMenuButton
              onClick={() => setSidebarOpen(true)}
              aria-label="打开菜单"
            >
              <Menu size={20} />
            </MobileMenuButton>
          </UserSection>
        </HeaderContent>
      </Header>

      <MainContent>
        <SidebarOverlay 
          $isVisible={sidebarOpen} 
          onClick={closeSidebar} 
        />
        
        <Sidebar $isOpen={sidebarOpen}>
          <SidebarHeader>
            <h2>菜单</h2>
            <CloseButton 
              onClick={closeSidebar}
              aria-label="关闭菜单"
            >
              <X size={20} />
            </CloseButton>
          </SidebarHeader>
          
          <Nav>
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  $isActive={isActive}
                  onClick={closeSidebar}
                >
                  <Icon />
                  {item.name}
                </NavLink>
              );
            })}
          </Nav>
        </Sidebar>

        <ContentArea>
          {children}
        </ContentArea>
      </MainContent>
    </LayoutContainer>
  );
};

export default Layout;
