import React from 'react';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { LoadingSpinner } from './common/LoadingSpinner';
import { supabase } from '../lib/supabase';
import { 
  BarChart3, 
  Target, 
  Users, 
  Calendar, 
  Search, 
  Settings, 
  LogOut,
  Crown,
  Zap,
  MessageSquare,
  TrendingUp,
  User,
  Eye,
  ChevronDown,
  ChevronRight,
  Plus,
  Sparkles,
  Shield,
  Database,
  Palette,
  Bell
} from 'lucide-react';

export function Layout() {
  const { user, signOut, loading } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();
  const [sidebarExpanded, setSidebarExpanded] = React.useState(false);
  const [recentCampaigns, setRecentCampaigns] = React.useState<any[]>([]);
  const [recentLists, setRecentLists] = React.useState<any[]>([]);
  const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>({
    campaigns: true,
    lists: true,
    tools: false,
    settings: false
  });

  React.useEffect(() => {
    if (user && sidebarExpanded) {
      fetchRecentItems();
    }
  }, [user, sidebarExpanded]);

  const fetchRecentItems = async () => {
    if (!user) return;

    try {
      // Fetch recent campaigns
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, offer, status')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(5);

      // Fetch recent lists
      const { data: lists } = await supabase
        .from('lists')
        .select('id, name, description')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(5);

      setRecentCampaigns(campaigns || []);
      setRecentLists(lists || []);
    } catch (error) {
      console.error('Error fetching recent items:', error);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'gold' 
          ? 'bg-gradient-to-br from-black via-gray-900 to-black'
          : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-4 border-transparent mx-auto mb-4 ${
            theme === 'gold'
              ? 'border-t-yellow-400'
              : 'border-t-blue-600'
          }`}></div>
          <p className={`text-sm ${
            theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Loading application...
          </p>
          <p className={`text-xs mt-2 ${
            theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
          }`}>
            If this takes too long, try refreshing the page
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const mainNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
    { name: 'Chat', href: '/targeting', icon: MessageSquare },
    { name: 'CRM', href: '/booked', icon: Calendar },
  ];

  const campaignTools = [
    { name: 'All Campaigns', href: '/campaigns', icon: Target },
    { name: 'New Campaign', href: '/campaigns?new=true', icon: Plus },
  ];

  const listTools = [
    { name: 'All Lists', href: '/lists', icon: Users },
    { name: 'Discover Leads', href: '/lists?discover=true', icon: Sparkles },
  ];

  const tools = [
    { name: 'AI Discovery', href: '/targeting', icon: Sparkles },
    { name: 'Lead Analytics', href: '/lists?analytics=true', icon: BarChart3 },
    { name: 'Data Cleaning', href: '/lists?clean=true', icon: Shield },
  ];

  const settingsItems = [
    { name: 'Channels', href: '/settings?tab=channels', icon: MessageSquare },
    { name: 'Appearance', href: '/settings?tab=appearance', icon: Palette },
    { name: 'Notifications', href: '/settings?tab=notifications', icon: Bell },
    { name: 'Security', href: '/settings?tab=security', icon: Shield },
    { name: 'Credentials', href: '/settings?tab=vault', icon: Database },
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className={`min-h-screen relative ${
      theme === 'gold' 
        ? 'bg-gradient-to-br from-black via-gray-900 to-black'
        : 'bg-gray-50'
    }`}>
      {/* Sidebar */}
      <div 
        className={`fixed left-0 top-0 h-full z-30 transition-all duration-300 ease-in-out flex flex-col ${
          sidebarExpanded ? 'w-64' : 'w-16'
        } ${
        theme === 'gold' 
          ? 'bg-black border-r border-yellow-400/20'
          : 'bg-white border-r border-gray-200'
        }`}
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >
        {/* Logo */}
        <div className={`flex items-center justify-center h-16 border-b ${
          theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            theme === 'gold' ? 'gold-gradient' : 'bg-blue-600'
          }`}>
            <Eye className={`h-6 w-6 ${
              theme === 'gold' ? 'text-black' : 'text-white'
            }`} />
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-6 px-3 overflow-hidden">
          {/* Main Navigation */}
          <div className="space-y-1 mb-6">
            {mainNavigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href || 
                (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 relative ${
                    isActive
                      ? theme === 'gold'
                        ? 'gold-gradient text-black'
                        : 'bg-blue-50 text-blue-700'
                      : theme === 'gold'
                        ? 'text-gray-300 hover:text-yellow-400 hover:bg-yellow-400/10'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  title={!sidebarExpanded ? item.name : undefined}
                >
                  <Icon className={`mr-3 h-5 w-5 ${
                    isActive
                      ? theme === 'gold'
                        ? 'text-black'
                        : 'text-blue-700'
                      : theme === 'gold'
                        ? 'text-gray-400 group-hover:text-yellow-400'
                        : 'text-gray-400 group-hover:text-gray-500'
                  }`} />
                  <span className={`ml-3 whitespace-nowrap transition-opacity duration-200 ${
                    sidebarExpanded ? 'opacity-100' : 'opacity-0'
                  }`}>
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Expandable Sections */}
          {sidebarExpanded && (
            <div className="space-y-4">
              {/* Campaigns Section */}
              <div>
                <button
                  onClick={() => toggleSection('campaigns')}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    theme === 'gold'
                      ? 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/10'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center">
                    <Target className={`h-4 w-4 mr-3 ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                    }`} />
                    <span>Campaigns</span>
                  </div>
                  {expandedSections.campaigns ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                
                {expandedSections.campaigns && (
                  <div className="ml-6 mt-2 space-y-1">
                    {campaignTools.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.href;
                      
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          className={`group flex items-center px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            isActive
                              ? theme === 'gold'
                                ? 'bg-yellow-400/20 text-yellow-400'
                                : 'bg-blue-50 text-blue-700'
                              : theme === 'gold'
                                ? 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/5'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className="h-4 w-4 mr-2" />
                          {item.name}
                        </Link>
                      );
                    })}
                    
                    {/* Recent Campaigns */}
                    {recentCampaigns.length > 0 && (
                      <>
                        <div className={`px-3 py-1 text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-500' : 'text-gray-400'
                        }`}>
                          Recent
                        </div>
                        {recentCampaigns.map((campaign) => (
                          <Link
                            key={campaign.id}
                            to={`/campaigns/${campaign.id}/edit`}
                            className={`group flex items-center px-3 py-1.5 text-sm rounded-lg transition-colors ${
                              location.pathname.includes(campaign.id)
                                ? theme === 'gold'
                                  ? 'bg-yellow-400/20 text-yellow-400'
                                  : 'bg-blue-50 text-blue-700'
                                : theme === 'gold'
                                  ? 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/5'
                                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <div className={`w-2 h-2 rounded-full mr-3 ${
                              campaign.status === 'active'
                                ? 'bg-green-400'
                                : campaign.status === 'paused'
                                ? 'bg-yellow-400'
                                : 'bg-gray-400'
                            }`} />
                            <span className="truncate">
                              {campaign.offer ? 
                                (campaign.offer.length > 25 ? `${campaign.offer.substring(0, 25)}...` : campaign.offer) :
                                'Untitled Campaign'
                              }
                            </span>
                          </Link>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Lists Section */}
              <div>
                <button
                  onClick={() => toggleSection('lists')}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    theme === 'gold'
                      ? 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/10'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center">
                    <Users className={`h-4 w-4 mr-3 ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                    }`} />
                    <span>Lists</span>
                  </div>
                  {expandedSections.lists ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                
                {expandedSections.lists && (
                  <div className="ml-6 mt-2 space-y-1">
                    {listTools.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.href;
                      
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          className={`group flex items-center px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            isActive
                              ? theme === 'gold'
                                ? 'bg-yellow-400/20 text-yellow-400'
                                : 'bg-blue-50 text-blue-700'
                              : theme === 'gold'
                                ? 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/5'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className="h-4 w-4 mr-2" />
                          {item.name}
                        </Link>
                      );
                    })}
                    
                    {/* Recent Lists */}
                    {recentLists.length > 0 && (
                      <>
                        <div className={`px-3 py-1 text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-500' : 'text-gray-400'
                        }`}>
                          Recent
                        </div>
                        {recentLists.map((list) => (
                          <Link
                            key={list.id}
                            to={`/lists?list=${list.id}`}
                            className={`group flex items-center px-3 py-1.5 text-sm rounded-lg transition-colors ${
                              location.search.includes(list.id)
                                ? theme === 'gold'
                                  ? 'bg-yellow-400/20 text-yellow-400'
                                  : 'bg-blue-50 text-blue-700'
                                : theme === 'gold'
                                  ? 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/5'
                                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <div className={`w-2 h-2 rounded-full mr-3 ${
                              theme === 'gold' ? 'bg-blue-400' : 'bg-blue-500'
                            }`} />
                            <span className="truncate">
                              {list.name.length > 25 ? `${list.name.substring(0, 25)}...` : list.name}
                            </span>
                          </Link>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Tools Section */}
              <div>
                <button
                  onClick={() => toggleSection('tools')}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    theme === 'gold'
                      ? 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/10'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center">
                    <Sparkles className={`h-4 w-4 mr-3 ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                    }`} />
                    <span>Tools</span>
                  </div>
                  {expandedSections.tools ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                
                {expandedSections.tools && (
                  <div className="ml-6 mt-2 space-y-1">
                    {tools.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.href || 
                        (item.href.includes('?') && location.pathname + location.search === item.href);
                      
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          className={`group flex items-center px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            isActive
                              ? theme === 'gold'
                                ? 'bg-yellow-400/20 text-yellow-400'
                                : 'bg-blue-50 text-blue-700'
                              : theme === 'gold'
                                ? 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/5'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className="h-4 w-4 mr-2" />
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Settings Section */}
              <div>
                <button
                  onClick={() => toggleSection('settings')}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    location.pathname === '/settings'
                      ? theme === 'gold'
                        ? 'gold-gradient text-black'
                        : 'bg-blue-50 text-blue-700'
                      : theme === 'gold'
                        ? 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/10'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center">
                    <Settings className={`h-4 w-4 mr-3 ${
                      location.pathname === '/settings'
                        ? theme === 'gold'
                          ? 'text-black'
                          : 'text-blue-700'
                        : theme === 'gold'
                          ? 'text-gray-400'
                          : 'text-gray-500'
                    }`} />
                    <span>Settings</span>
                  </div>
                  {expandedSections.settings ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                
                {expandedSections.settings && (
                  <div className="ml-6 mt-2 space-y-1">
                    {settingsItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === '/settings' && 
                        (location.search.includes(item.href.split('?tab=')[1]) || 
                         (!location.search && item.href.includes('channels')));
                      
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          className={`group flex items-center px-3 py-1.5 text-sm rounded-lg transition-colors ${
                            isActive
                              ? theme === 'gold'
                                ? 'bg-yellow-400/20 text-yellow-400'
                                : 'bg-blue-50 text-blue-700'
                              : theme === 'gold'
                                ? 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/5'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className="h-4 w-4 mr-2" />
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </nav>

        {/* User Profile */}
        <div className={`absolute bottom-0 w-full p-4 border-t overflow-hidden ${
          theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
        }`}>
          <div className={`flex items-center ${sidebarExpanded ? 'justify-between' : 'justify-center'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              theme === 'gold' ? 'bg-yellow-400/20' : 'bg-gray-100'
            }`}>
              <User className={`h-5 w-5 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-gray-600'
              }`} />
            </div>
            {sidebarExpanded && (
              <>
                <div className="ml-3 flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
                  </p>
                  <p className={`text-xs ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Member
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  className={`p-2 rounded-lg transition-colors ${
                    theme === 'gold'
                      ? 'text-gray-400 hover:text-red-400 hover:bg-red-400/10'
                      : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                  }`}
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden ml-16">
        <main className="py-6 px-4 sm:px-6 lg:px-8 min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  );
}