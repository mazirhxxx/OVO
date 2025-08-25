import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { LoadingSpinner } from './common/LoadingSpinner';
import { ErrorMessage } from './common/ErrorMessage';
import { CredentialsManager } from '../utils/credentialsManager';
import { AutoCaptureFlow } from './AutoCaptureFlow';
import { 
  Shield, 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Clock,
  Settings,
  Trash2,
  RefreshCw,
  Copy,
  ExternalLink,
  Key,
  Cookie,
  Code,
  Crown,
  Zap,
  Lock,
  Unlock,
  TestTube,
  Save,
  X,
  Globe,
  Database,
  Sparkles
} from 'lucide-react';

// Actor Registry from the provided JSON
const ACTOR_REGISTRY = [
  {
    "slug": "linkedin-basic",
    "title": "LinkedIn (Basic)",
    "category": "social",
    "requiresCookies": true,
    "targetDomain": "linkedin.com",
    "fields": [
      { "key": "cookieString", "label": "Raw Cookie String", "type": "textarea", "required": false, "mask": false, "helper": "Paste full document.cookie from .linkedin.com" },
      { "key": "li_at", "label": "li_at", "type": "password", "required": true, "mask": true, "helper": "Chrome → DevTools → Application → Cookies → .linkedin.com" },
      { "key": "JSESSIONID", "label": "JSESSIONID", "type": "password", "required": true, "mask": true, "helper": ".linkedin.com" },
      { "key": "userAgent", "label": "User Agent", "type": "text", "required": true, "mask": false, "helper": "navigator.userAgent" }
    ],
    "verifyHint": "Fetch https://www.linkedin.com/feed/ and detect logged-in marker"
  },
  {
    "slug": "linkedin-sales-navigator",
    "title": "LinkedIn Sales Navigator",
    "category": "social",
    "requiresCookies": true,
    "targetDomain": "linkedin.com",
    "fields": [
      { "key": "cookieString", "label": "Raw Cookie String", "type": "textarea", "required": false, "mask": false, "helper": "Paste full document.cookie from .linkedin.com" },
      { "key": "li_at", "label": "li_at", "type": "password", "required": true, "mask": true },
      { "key": "JSESSIONID", "label": "JSESSIONID", "type": "password", "required": true, "mask": true },
      { "key": "li_a", "label": "li_a (if present)", "type": "password", "required": false, "mask": true },
      { "key": "userAgent", "label": "User Agent", "type": "text", "required": true, "mask": false }
    ],
    "verifyHint": "Fetch a Sales Navigator page and ensure no auth redirect"
  },
  {
    "slug": "x-twitter",
    "title": "X / Twitter",
    "category": "social",
    "requiresCookies": true,
    "targetDomain": "x.com",
    "fields": [
      { "key": "cookieString", "label": "Raw Cookie String", "type": "textarea", "required": false, "mask": false, "helper": "Paste from .x.com or .twitter.com" },
      { "key": "auth_token", "label": "auth_token", "type": "password", "required": true, "mask": true },
      { "key": "ct0", "label": "ct0 (CSRF)", "type": "password", "required": true, "mask": true },
      { "key": "userAgent", "label": "User Agent", "type": "text", "required": true, "mask": false }
    ],
    "verifyHint": "Fetch https://x.com/settings/account or who-am-I endpoint"
  },
  {
    "slug": "facebook-groups",
    "title": "Facebook (Groups)",
    "category": "social",
    "requiresCookies": true,
    "targetDomain": "facebook.com",
    "fields": [
      { "key": "cookieString", "label": "Raw Cookie String", "type": "textarea", "required": false, "mask": false, "helper": "Paste from .facebook.com" },
      { "key": "c_user", "label": "c_user", "type": "password", "required": true, "mask": true },
      { "key": "xs", "label": "xs", "type": "password", "required": true, "mask": true },
      { "key": "fr", "label": "fr", "type": "password", "required": false, "mask": true },
      { "key": "userAgent", "label": "User Agent", "type": "text", "required": true, "mask": false }
    ],
    "verifyHint": "Fetch a joined group page and ensure HTML contains user markers"
  },
  {
    "slug": "facebook-pages",
    "title": "Facebook (Pages)",
    "category": "social",
    "requiresCookies": true,
    "targetDomain": "facebook.com",
    "fields": [
      { "key": "cookieString", "label": "Raw Cookie String", "type": "textarea", "required": false, "mask": false },
      { "key": "c_user", "label": "c_user", "type": "password", "required": true, "mask": true },
      { "key": "xs", "label": "xs", "type": "password", "required": true, "mask": true },
      { "key": "fr", "label": "fr", "type": "password", "required": false, "mask": true },
      { "key": "userAgent", "label": "User Agent", "type": "text", "required": true, "mask": false }
    ],
    "verifyHint": "Fetch /me or a managed page and detect login"
  },
  {
    "slug": "instagram-basic",
    "title": "Instagram",
    "category": "social",
    "requiresCookies": true,
    "targetDomain": "instagram.com",
    "fields": [
      { "key": "cookieString", "label": "Raw Cookie String", "type": "textarea", "required": false, "mask": false, "helper": "Paste from .instagram.com" },
      { "key": "sessionid", "label": "sessionid", "type": "password", "required": true, "mask": true },
      { "key": "csrftoken", "label": "csrftoken", "type": "password", "required": true, "mask": true },
      { "key": "userAgent", "label": "User Agent", "type": "text", "required": true, "mask": false }
    ],
    "verifyHint": "Fetch profile page and detect logged-in state"
  },
  {
    "slug": "reddit-auth",
    "title": "Reddit",
    "category": "social",
    "requiresCookies": true,
    "targetDomain": "reddit.com",
    "fields": [
      { "key": "cookieString", "label": "Raw Cookie String", "type": "textarea", "required": false, "mask": false, "helper": "Paste from .reddit.com" },
      { "key": "reddit_session", "label": "reddit_session (or OAuth token)", "type": "password", "required": true, "mask": true },
      { "key": "userAgent", "label": "User Agent", "type": "text", "required": true, "mask": false }
    ],
    "verifyHint": "Fetch https://www.reddit.com/settings/ and ensure no redirect"
  },
  {
    "slug": "google-maps",
    "title": "Google Maps",
    "category": "maps",
    "requiresCookies": true,
    "targetDomain": "maps.google.com",
    "fields": [
      { "key": "cookieString", "label": "Raw Cookie String", "type": "textarea", "required": false, "mask": false, "helper": "Paste from .google.com / .maps.google.com" },
      { "key": "SAPISID", "label": "SAPISID", "type": "password", "required": true, "mask": true },
      { "key": "__Secure-3PSAPISID", "label": "__Secure-3PSAPISID", "type": "password", "required": true, "mask": true },
      { "key": "userAgent", "label": "User Agent", "type": "text", "required": true, "mask": false }
    ],
    "verifyHint": "Fetch a business page; ensure not blocked and cookie accepted"
  },
  {
    "slug": "maps-business-details",
    "title": "Maps Business Details",
    "category": "maps",
    "requiresCookies": true,
    "targetDomain": "maps.google.com",
    "fields": [
      { "key": "reuseFrom", "label": "Reuse from Integration", "type": "select", "required": false, "mask": false, "helper": "Select 'google-maps' to reuse" },
      { "key": "userAgent", "label": "User Agent", "type": "text", "required": true, "mask": false }
    ],
    "verifyHint": "Same as Google Maps; detail endpoint"
  },
  {
    "slug": "indeed-jobs",
    "title": "Indeed Jobs",
    "category": "jobs",
    "requiresCookies": true,
    "targetDomain": "indeed.com",
    "fields": [
      { "key": "cookieString", "label": "Raw Cookie String", "type": "textarea", "required": false, "mask": false, "helper": "Paste from .indeed.com" },
      { "key": "CTK", "label": "CTK (session)", "type": "password", "required": true, "mask": true },
      { "key": "userAgent", "label": "User Agent", "type": "text", "required": true, "mask": false }
    ],
    "verifyHint": "Fetch a saved jobs page and ensure session is valid"
  },
  {
    "slug": "glassdoor",
    "title": "Glassdoor",
    "category": "jobs",
    "requiresCookies": true,
    "targetDomain": "glassdoor.com",
    "fields": [
      { "key": "cookieString", "label": "Raw Cookie String", "type": "textarea", "required": false, "mask": false, "helper": "Paste from .glassdoor.com" },
      { "key": "GDSession", "label": "GDSession", "type": "password", "required": true, "mask": true },
      { "key": "TS*", "label": "TS*", "type": "password", "required": false, "mask": true, "helper": "Security cookie often named TSxxxxx" },
      { "key": "userAgent", "label": "User Agent", "type": "text", "required": true, "mask": false }
    ],
    "verifyHint": "Fetch /member/home and detect login"
  },
  {
    "slug": "apollo-portal",
    "title": "Apollo.io Portal",
    "category": "enrichment",
    "requiresCookies": false,
    "targetDomain": "apollo.io",
    "fields": [
      { "key": "apiKey", "label": "API Key (preferred)", "type": "password", "required": false, "mask": true },
      { "key": "apollographql.session", "label": "apollographql.session (cookie)", "type": "password", "required": false, "mask": true },
      { "key": "userAgent", "label": "User Agent", "type": "text", "required": false, "mask": false }
    ],
    "verifyHint": "Ping API key or fetch minimal GraphQL with cookie"
  },
  {
    "slug": "contactout",
    "title": "ContactOut",
    "category": "enrichment",
    "requiresCookies": true,
    "targetDomain": "contactout.com",
    "fields": [
      { "key": "cookieString", "label": "Raw Cookie String", "type": "textarea", "required": false, "mask": false, "helper": "Paste from portal.contactout.com" },
      { "key": "co_session", "label": "Portal session (name may vary)", "type": "password", "required": true, "mask": true },
      { "key": "userAgent", "label": "User Agent", "type": "text", "required": true, "mask": false }
    ],
    "verifyHint": "Fetch dashboard page; ensure credits visible"
  },
  {
    "slug": "hunter-io",
    "title": "Hunter.io",
    "category": "enrichment",
    "requiresCookies": false,
    "targetDomain": "hunter.io",
    "fields": [
      { "key": "apiKey", "label": "API Key", "type": "password", "required": true, "mask": true }
    ],
    "verifyHint": "Ping account endpoint"
  },
  {
    "slug": "people-data-labs",
    "title": "People Data Labs",
    "category": "enrichment",
    "requiresCookies": false,
    "targetDomain": "peopledatalabs.com",
    "fields": [
      { "key": "apiKey", "label": "API Key", "type": "password", "required": true, "mask": true }
    ],
    "verifyHint": "Ping API key usage endpoint"
  },
  {
    "slug": "dropcontact",
    "title": "Dropcontact",
    "category": "enrichment",
    "requiresCookies": false,
    "targetDomain": "dropcontact.io",
    "fields": [
      { "key": "apiKey", "label": "API Key", "type": "password", "required": true, "mask": true }
    ],
    "verifyHint": "Ping status endpoint"
  },
  {
    "slug": "serper-bing",
    "title": "Serper / Bing API",
    "category": "search",
    "requiresCookies": false,
    "targetDomain": "serper.dev",
    "fields": [
      { "key": "apiKey", "label": "API Key", "type": "password", "required": true, "mask": true }
    ],
    "verifyHint": "Ping test search"
  },
  {
    "slug": "github-scraper",
    "title": "GitHub",
    "category": "developer",
    "requiresCookies": true,
    "targetDomain": "github.com",
    "fields": [
      { "key": "cookieString", "label": "Raw Cookie String", "type": "textarea", "required": false, "mask": false, "helper": "Paste from .github.com" },
      { "key": "userSession", "label": "userSession (or token)", "type": "password", "required": true, "mask": true },
      { "key": "userAgent", "label": "User Agent", "type": "text", "required": true, "mask": false }
    ],
    "verifyHint": "Fetch profile page while authenticated"
  },
  {
    "slug": "stackoverflow-jobs",
    "title": "StackOverflow Jobs",
    "category": "jobs",
    "requiresCookies": true,
    "targetDomain": "stackoverflow.com",
    "fields": [
      { "key": "cookieString", "label": "Raw Cookie String", "type": "textarea", "required": false, "mask": false, "helper": "Paste from .stackoverflow.com" },
      { "key": "acct", "label": "acct/session (name varies)", "type": "password", "required": true, "mask": true },
      { "key": "userAgent", "label": "User Agent", "type": "text", "required": true, "mask": false }
    ],
    "verifyHint": "Fetch saved jobs page"
  },
  {
    "slug": "ycombinator-hn",
    "title": "Hacker News",
    "category": "community",
    "requiresCookies": false,
    "targetDomain": "news.ycombinator.com",
    "fields": [],
    "verifyHint": "No auth required"
  },
  {
    "slug": "google-scholar",
    "title": "Google Scholar",
    "category": "academic",
    "requiresCookies": true,
    "targetDomain": "scholar.google.com",
    "fields": [
      { "key": "cookieString", "label": "Raw Cookie String", "type": "textarea", "required": false, "mask": false, "helper": "Paste from .scholar.google.com" },
      { "key": "SID", "label": "SID (or SAPISID)", "type": "password", "required": true, "mask": true },
      { "key": "userAgent", "label": "User Agent", "type": "text", "required": true, "mask": false }
    ],
    "verifyHint": "Fetch profile/search page without captcha"
  }
];

interface UserCredential {
  id: string;
  actor_slug: string;
  status: 'connected' | 'expired' | 'failed' | 'unverified';
  last_verified_at: string | null;
  verification_attempts: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CredentialForm {
  [key: string]: string;
}

export function CredentialsVault() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [userCredentials, setUserCredentials] = useState<UserCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedActor, setSelectedActor] = useState<any | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showAutoCapture, setShowAutoCapture] = useState(false);
  const [activeTab, setActiveTab] = useState<'connect' | 'how-to' | 'verify' | 'advanced'>('connect');
  const [formData, setFormData] = useState<CredentialForm>({});
  const [showRawCookies, setShowRawCookies] = useState(false);
  const [rawCookieString, setRawCookieString] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user) {
      fetchUserCredentials();
    }
  }, [user]);

  const fetchUserCredentials = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // For now, we'll simulate the credentials data since the table doesn't exist yet
      // In a real implementation, this would fetch from the user_credentials table
      setUserCredentials([]);
    } catch (error) {
      console.error('Error fetching credentials:', error);
      setError('Failed to load credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectActor = (actor: any) => {
    setSelectedActor(actor);
    setFormData({});
    setRawCookieString('');
    setShowRawCookies(false);
    setActiveTab('connect');
    setShowConnectModal(true);
  };

  const parseCookieString = (cookieString: string): Record<string, string> => {
    const cookies: Record<string, string> = {};
    
    cookieString.split(';').forEach(cookie => {
      const [key, ...valueParts] = cookie.split('=');
      if (key && valueParts.length > 0) {
        const cleanKey = key.trim();
        const cleanValue = valueParts.join('=').trim();
        if (cleanKey && cleanValue) {
          cookies[cleanKey] = cleanValue;
        }
      }
    });
    
    return cookies;
  };

  const handleRawCookiesParse = () => {
    if (!rawCookieString.trim() || !selectedActor) return;
    
    const parsedCookies = parseCookieString(rawCookieString);
    const newFormData = { ...formData };
    
    // Map parsed cookies to form fields
    selectedActor.fields.forEach((field: any) => {
      if (field.type === 'password' && parsedCookies[field.key]) {
        newFormData[field.key] = parsedCookies[field.key];
      }
    });
    
    // Auto-fill user agent
    newFormData.userAgent = navigator.userAgent;
    
    setFormData(newFormData);
  };

  const handleSaveCredentials = async () => {
    if (!selectedActor || !user) return;

    setSaving(true);
    try {
      // Validate required fields
      const missingFields = selectedActor.fields
        .filter((field: any) => field.required && !formData[field.key]?.trim())
        .map((field: any) => field.label);

      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // For now, simulate saving since the backend isn't fully implemented
      // In a real implementation, this would call the store-credentials edge function
      console.log('Would save credentials for:', selectedActor.slug, formData);
      
      setShowConnectModal(false);
      fetchUserCredentials();
    } catch (error) {
      console.error('Error saving credentials:', error);
      setError(error instanceof Error ? error.message : 'Failed to save credentials');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyCredentials = async (actorSlug: string) => {
    setTesting(actorSlug);
    try {
      // Simulate verification
      setTimeout(() => {
        setTesting(null);
        fetchUserCredentials();
      }, 2000);
    } catch (error) {
      console.error('Error verifying credentials:', error);
    }
  };

  const handleDeleteCredentials = async (actorSlug: string) => {
    if (!confirm('Are you sure you want to delete these credentials?')) return;

    try {
      // Simulate deletion
      fetchUserCredentials();
    } catch (error) {
      console.error('Error deleting credentials:', error);
      setError('Failed to delete credentials');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return CheckCircle;
      case 'failed':
      case 'expired':
        return XCircle;
      case 'unverified':
        return AlertTriangle;
      default:
        return Clock;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return theme === 'gold' ? 'text-green-400' : 'text-green-600';
      case 'failed':
      case 'expired':
        return theme === 'gold' ? 'text-red-400' : 'text-red-600';
      case 'unverified':
        return theme === 'gold' ? 'text-yellow-400' : 'text-yellow-600';
      default:
        return theme === 'gold' ? 'text-gray-400' : 'text-gray-600';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'social':
        return '👥';
      case 'maps':
        return '🗺️';
      case 'jobs':
        return '💼';
      case 'enrichment':
        return '🔍';
      case 'search':
        return '🔎';
      case 'developer':
        return '👨‍💻';
      case 'academic':
        return '🎓';
      case 'community':
        return '💬';
      default:
        return '⚙️';
    }
  };

  const filteredActors = ACTOR_REGISTRY.filter(actor => {
    const matchesSearch = !searchTerm || 
      actor.title.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = !selectedCategory || actor.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(ACTOR_REGISTRY.map(actor => actor.category))];

  const getCredentialStatus = (actorSlug: string) => {
    return userCredentials.find(cred => cred.actor_slug === actorSlug);
  };

  if (loading) {
    return <LoadingSpinner size="lg" message="Loading credentials vault..." className="h-64" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            {theme === 'gold' ? (
              <Crown className="h-8 w-8 text-yellow-400" />
            ) : (
              <Shield className="h-8 w-8 text-blue-600" />
            )}
            <h1 className={`text-3xl font-bold ${
              theme === 'gold' ? 'gold-text-gradient' : 'text-gray-900'
            }`}>
              Credentials Vault
            </h1>
          </div>
          <p className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
            Securely manage cookies and API keys for {ACTOR_REGISTRY.length} scraping integrations
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <ErrorMessage
          message={error}
          onDismiss={() => setError('')}
        />
      )}

      {/* Search and Filters */}
      <div className={`p-4 rounded-xl border ${
        theme === 'gold' 
          ? 'black-card gold-border' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-gray-400'
              }`} />
              <input
                type="text"
                placeholder="Search integrations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  theme === 'gold'
                    ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                    : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                } focus:border-transparent`}
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex items-center space-x-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                theme === 'gold'
                  ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                  : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
              } focus:border-transparent`}
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {getCategoryIcon(category)} {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredActors.map((actor) => {
          const credential = getCredentialStatus(actor.slug);
          const StatusIcon = getStatusIcon(credential?.status || 'unverified');
          
          return (
            <div
              key={actor.slug}
              className={`p-6 rounded-xl border transition-all hover:shadow-md ${
                theme === 'gold'
                  ? 'black-card gold-border hover:gold-shadow'
                  : 'bg-white border-gray-200 hover:shadow-lg'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`text-2xl`}>
                    {getCategoryIcon(actor.category)}
                  </div>
                  <div>
                    <h3 className={`font-semibold ${
                      theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                    }`}>
                      {actor.title}
                    </h3>
                    <p className={`text-sm ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {actor.targetDomain}
                    </p>
                  </div>
                </div>
                
                {/* Status */}
                <div className="flex items-center space-x-2">
                  <StatusIcon className={`h-5 w-5 ${getStatusColor(credential?.status || 'unverified')}`} />
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    credential?.status === 'connected'
                      ? theme === 'gold' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-800'
                      : credential?.status === 'failed' || credential?.status === 'expired'
                      ? theme === 'gold' ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-800'
                      : credential?.status === 'unverified'
                      ? theme === 'gold' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-800'
                      : theme === 'gold' ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {credential?.status === 'connected' ? 'Connected' :
                     credential?.status === 'failed' ? 'Failed' :
                     credential?.status === 'expired' ? 'Expired' :
                     credential?.status === 'unverified' ? 'Unverified' :
                     'Not Connected'}
                  </span>
                </div>
              </div>

              {/* Requirements */}
              <div className="mb-4 space-y-2">
                <div className={`text-xs ${
                  theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                }`}>
                  Requires:
                </div>
                <div className="flex flex-wrap gap-2">
                  {actor.requiresCookies ? (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      theme === 'gold'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      <Cookie className="h-3 w-3 inline mr-1" />
                      Cookies
                    </span>
                  ) : (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      theme === 'gold'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      <Key className="h-3 w-3 inline mr-1" />
                      API Key
                    </span>
                  )}
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    theme === 'gold'
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    <Code className="h-3 w-3 inline mr-1" />
                    User Agent
                  </span>
                </div>
              </div>

              {/* Last Verified */}
              {credential?.last_verified_at && (
                <div className={`text-xs mb-4 ${
                  theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                }`}>
                  Last verified: {new Date(credential.last_verified_at).toLocaleDateString()}
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2">
                {credential ? (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleVerifyCredentials(actor.slug)}
                      disabled={testing === actor.slug}
                      className={`flex-1 inline-flex items-center justify-center px-3 py-2 text-sm rounded-lg transition-colors ${
                        theme === 'gold'
                          ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      } disabled:opacity-50`}
                    >
                      {testing === actor.slug ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      ) : (
                        <TestTube className="h-4 w-4 mr-2" />
                      )}
                      {testing === actor.slug ? 'Testing...' : 'Verify'}
                    </button>
                    <button
                      onClick={() => handleConnectActor(actor)}
                      className={`p-2 rounded-lg transition-colors ${
                        theme === 'gold'
                          ? 'text-gray-400 hover:bg-gray-800'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                      title="Edit credentials"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCredentials(actor.slug)}
                      className={`p-2 rounded-lg transition-colors ${
                        theme === 'gold'
                          ? 'text-red-400 hover:bg-red-400/10'
                          : 'text-red-600 hover:bg-red-50'
                      }`}
                      title="Delete credentials"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Auto-Capture Button (Primary) */}
                    {actor.requiresCookies && (
                      <button
                        onClick={() => {
                          setSelectedActor(actor);
                          setShowAutoCapture(true);
                        }}
                        className={`w-full inline-flex items-center justify-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                          theme === 'gold'
                            ? 'gold-gradient text-black hover-gold'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Connect Automatically
                        <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                          theme === 'gold' ? 'bg-black/20' : 'bg-blue-500'
                        }`}>
                          Recommended
                        </span>
                      </button>
                    )}
                    
                    {/* Manual Setup Button (Secondary) */}
                    <button
                      onClick={() => handleConnectActor(actor)}
                      className={`w-full inline-flex items-center justify-center px-4 py-2 text-sm rounded-lg border transition-colors ${
                        theme === 'gold'
                          ? 'border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      {actor.requiresCookies ? 'Manual Setup' : 'Connect'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Auto-Capture Flow Modal */}
      {showAutoCapture && selectedActor && (
        <AutoCaptureFlow
          actor={selectedActor}
          onClose={() => {
            setShowAutoCapture(false);
            setSelectedActor(null);
          }}
          onSuccess={() => {
            setShowAutoCapture(false);
            setSelectedActor(null);
            fetchUserCredentials();
          }}
        />
      )}

      {/* Manual Connect Modal */}
      {showConnectModal && selectedActor && (
        <div className={`fixed inset-0 z-50 overflow-y-auto ${
          theme === 'gold' ? 'bg-black/75' : 'bg-gray-900/50'
        }`}>
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className={`w-full max-w-4xl rounded-xl shadow-2xl ${
              theme === 'gold' ? 'black-card gold-border' : 'bg-white border border-gray-200'
            }`}>
              {/* Modal Header */}
              <div className={`p-6 border-b ${
                theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">
                      {getCategoryIcon(selectedActor.category)}
                    </div>
                    <div>
                      <h2 className={`text-xl font-bold ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        Connect {selectedActor.title}
                      </h2>
                      <p className={`text-sm ${
                        theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {selectedActor.targetDomain}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowConnectModal(false)}
                    className={`p-2 rounded-lg transition-colors ${
                      theme === 'gold'
                        ? 'text-gray-400 hover:bg-gray-800'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className={`border-b ${
                theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
              }`}>
                <nav className="flex px-6">
                  {[
                    { key: 'connect', label: 'Connect', icon: Plus },
                    { key: 'how-to', label: 'How to get cookies', icon: Cookie },
                    { key: 'verify', label: 'Test & Verify', icon: TestTube },
                    { key: 'advanced', label: 'Advanced', icon: Settings }
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as any)}
                        className={`py-4 px-4 border-b-2 font-medium text-sm whitespace-nowrap flex items-center space-x-2 ${
                          activeTab === tab.key
                            ? theme === 'gold'
                              ? 'border-yellow-400 text-yellow-400'
                              : 'border-blue-500 text-blue-600'
                            : theme === 'gold'
                              ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {/* Connect Tab */}
                {activeTab === 'connect' && (
                  <div className="space-y-6">
                    {/* Auto-Capture Option */}
                    {selectedActor.requiresCookies && (
                      <div className={`p-6 rounded-lg border-2 ${
                        theme === 'gold'
                          ? 'border-yellow-400 bg-yellow-400/10'
                          : 'border-blue-500 bg-blue-50'
                      }`}>
                        <div className="flex items-center space-x-3 mb-4">
                          <Sparkles className={`h-6 w-6 ${
                            theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                          }`} />
                          <div>
                            <h3 className={`text-lg font-bold ${
                              theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                            }`}>
                              Connect Automatically (Recommended)
                            </h3>
                            <p className={`text-sm ${
                              theme === 'gold' ? 'text-yellow-300' : 'text-blue-500'
                            }`}>
                              Secure one-click setup with guided cookie capture
                            </p>
                          </div>
                        </div>
                        
                        <div className={`mb-4 p-3 rounded-lg ${
                          theme === 'gold' ? 'bg-black/20' : 'bg-white'
                        }`}>
                          <h4 className={`text-sm font-medium mb-2 ${
                            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                          }`}>
                            How it works:
                          </h4>
                          <ol className={`text-sm space-y-1 list-decimal list-inside ${
                            theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            <li>Opens secure helper window to {selectedActor.targetDomain}</li>
                            <li>Log in to your account (if needed)</li>
                            <li>Click "Capture Cookies" when ready</li>
                            <li>Review and confirm the captured data</li>
                            <li>Credentials are encrypted and stored securely</li>
                          </ol>
                        </div>

                        <button
                          onClick={() => {
                            setShowConnectModal(false);
                            setShowAutoCapture(true);
                          }}
                          className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
                            theme === 'gold'
                              ? 'gold-gradient text-black hover-gold'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Start Auto-Capture
                        </button>
                      </div>
                    )}

                    {/* Manual Setup */}
                    <div className={`p-6 rounded-lg border ${
                      theme === 'gold'
                        ? 'border-yellow-400/20 bg-black/20'
                        : 'border-gray-200 bg-gray-50'
                    }`}>
                      <h3 className={`text-lg font-semibold mb-4 ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        Manual Setup
                      </h3>

                      {/* Connection Method Toggle */}
                      {selectedActor.requiresCookies && (
                        <div className="mb-6">
                          <div className="flex rounded-lg overflow-hidden border">
                            <button
                              onClick={() => setShowRawCookies(false)}
                              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                                !showRawCookies
                                  ? theme === 'gold'
                                    ? 'gold-gradient text-black'
                                    : 'bg-blue-600 text-white'
                                  : theme === 'gold'
                                    ? 'text-gray-400 hover:bg-gray-800'
                                    : 'text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              Individual Fields
                            </button>
                            <button
                              onClick={() => setShowRawCookies(true)}
                              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                                showRawCookies
                                  ? theme === 'gold'
                                    ? 'gold-gradient text-black'
                                    : 'bg-blue-600 text-white'
                                  : theme === 'gold'
                                    ? 'text-gray-400 hover:bg-gray-800'
                                    : 'text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              Paste Cookie String
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Raw Cookie String Input */}
                      {showRawCookies && selectedActor.requiresCookies && (
                        <div className="mb-6 space-y-4">
                          <div>
                            <label className={`block text-sm font-medium mb-2 ${
                              theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                              Raw Cookie String
                            </label>
                            <textarea
                              value={rawCookieString}
                              onChange={(e) => setRawCookieString(e.target.value)}
                              rows={4}
                              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                                theme === 'gold'
                                  ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                                  : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                              }`}
                              placeholder="Paste your browser cookies here..."
                            />
                            <p className={`text-xs mt-1 ${
                              theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                            }`}>
                              Chrome: DevTools (F12) → Application → Cookies → {selectedActor.targetDomain}
                            </p>
                          </div>
                          <button
                            onClick={handleRawCookiesParse}
                            disabled={!rawCookieString.trim()}
                            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                              theme === 'gold'
                                ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                                : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                            } disabled:opacity-50`}
                          >
                            <Code className="h-4 w-4 mr-2" />
                            Parse Cookies
                          </button>
                        </div>
                      )}

                      {/* Dynamic Form Fields */}
                      <div className="space-y-4">
                        {selectedActor.fields
                          .filter((field: any) => field.key !== 'cookieString')
                          .map((field: any) => {
                            const isSecret = field.mask || field.type === 'password';
                            const showField = showSecrets[field.key] || false;
                            
                            return (
                              <div key={field.key}>
                                <label className={`block text-sm font-medium mb-2 ${
                                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                  {field.label}
                                  {field.required && <span className="text-red-500 ml-1">*</span>}
                                </label>
                                
                                <div className="relative">
                                  {field.type === 'textarea' ? (
                                    <textarea
                                      value={formData[field.key] || ''}
                                      onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        [field.key]: e.target.value
                                      }))}
                                      rows={3}
                                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                                        theme === 'gold'
                                          ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                                          : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                                      }`}
                                      placeholder={field.helper || ''}
                                    />
                                  ) : field.type === 'select' ? (
                                    <select
                                      value={formData[field.key] || ''}
                                      onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        [field.key]: e.target.value
                                      }))}
                                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                                        theme === 'gold'
                                          ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                                          : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                                      }`}
                                    >
                                      <option value="">Select...</option>
                                      <option value="google-maps">Google Maps</option>
                                    </select>
                                  ) : (
                                    <input
                                      type={isSecret && !showField ? 'password' : 'text'}
                                      value={formData[field.key] || (field.key === 'userAgent' ? navigator.userAgent : '')}
                                      onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        [field.key]: e.target.value
                                      }))}
                                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                                        isSecret ? 'pr-10' : ''
                                      } ${
                                        theme === 'gold'
                                          ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                                          : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                                      }`}
                                      placeholder={field.helper || ''}
                                      required={field.required}
                                    />
                                  )}
                                  
                                  {isSecret && (
                                    <button
                                      type="button"
                                      onClick={() => setShowSecrets(prev => ({
                                        ...prev,
                                        [field.key]: !showField
                                      }))}
                                      className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
                                        theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                                      }`}
                                    >
                                      {showField ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                  )}
                                </div>
                                
                                {field.helper && (
                                  <p className={`text-xs mt-1 ${
                                    theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                                  }`}>
                                    {field.helper}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex space-x-3 mt-6">
                        <button
                          onClick={() => setShowConnectModal(false)}
                          className={`flex-1 px-4 py-2 text-sm rounded-lg transition-colors ${
                            theme === 'gold'
                              ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                              : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                          }`}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveCredentials}
                          disabled={saving}
                          className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            theme === 'gold'
                              ? 'gold-gradient text-black hover-gold'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          } disabled:opacity-50`}
                        >
                          {saving ? (
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                              Saving...
                            </div>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Save & Encrypt
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* How To Tab */}
                {activeTab === 'how-to' && (
                  <div className="space-y-6">
                    <div className={`p-4 rounded-lg ${
                      theme === 'gold'
                        ? 'bg-blue-500/10 border border-blue-500/20'
                        : 'bg-blue-50 border border-blue-200'
                    }`}>
                      <h4 className={`text-sm font-medium mb-3 ${
                        theme === 'gold' ? 'text-blue-400' : 'text-blue-700'
                      }`}>
                        🍪 How to Get Cookies from {selectedActor.title}
                      </h4>
                      <div className={`text-sm space-y-2 ${
                        theme === 'gold' ? 'text-blue-300' : 'text-blue-600'
                      }`}>
                        <p><strong>Step 1:</strong> Open {selectedActor.targetDomain} in Chrome</p>
                        <p><strong>Step 2:</strong> Log in to your account</p>
                        <p><strong>Step 3:</strong> Press F12 to open DevTools</p>
                        <p><strong>Step 4:</strong> Go to Application → Cookies → .{selectedActor.targetDomain}</p>
                        <p><strong>Step 5:</strong> Copy the required cookie values listed below</p>
                      </div>
                    </div>

                    <div className={`p-4 rounded-lg ${
                      theme === 'gold'
                        ? 'border-yellow-400/20 bg-black/20'
                        : 'border-gray-200 bg-gray-50'
                    }`}>
                      <h4 className={`text-sm font-medium mb-3 ${
                        theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Required Cookies:
                      </h4>
                      <div className="space-y-2">
                        {selectedActor.fields
                          .filter((field: any) => field.type === 'password' && field.key !== 'userAgent')
                          .map((field: any) => (
                            <div key={field.key} className={`flex items-center justify-between p-2 rounded ${
                              theme === 'gold' ? 'bg-black/30' : 'bg-white'
                            }`}>
                              <span className={`text-sm font-mono ${
                                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                              }`}>
                                {field.key}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                field.required
                                  ? theme === 'gold' ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-800'
                                  : theme === 'gold' ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {field.required ? 'Required' : 'Optional'}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Verify Tab */}
                {activeTab === 'verify' && (
                  <div className="space-y-6">
                    <div className={`p-4 rounded-lg ${
                      theme === 'gold'
                        ? 'bg-green-500/10 border border-green-500/20'
                        : 'bg-green-50 border border-green-200'
                    }`}>
                      <h4 className={`text-sm font-medium mb-2 ${
                        theme === 'gold' ? 'text-green-400' : 'text-green-700'
                      }`}>
                        🔍 Verification Process
                      </h4>
                      <p className={`text-sm ${
                        theme === 'gold' ? 'text-green-300' : 'text-green-600'
                      }`}>
                        {selectedActor.verifyHint}
                      </p>
                    </div>

                    <button
                      onClick={() => handleVerifyCredentials(selectedActor.slug)}
                      disabled={testing === selectedActor.slug}
                      className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
                        theme === 'gold'
                          ? 'gold-gradient text-black hover-gold'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      } disabled:opacity-50`}
                    >
                      {testing === selectedActor.slug ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                          Verifying...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <TestTube className="h-4 w-4 mr-2" />
                          Test Connection
                        </div>
                      )}
                    </button>
                  </div>
                )}

                {/* Advanced Tab */}
                {activeTab === 'advanced' && (
                  <div className="space-y-6">
                    <div className={`p-4 rounded-lg ${
                      theme === 'gold'
                        ? 'bg-yellow-500/10 border border-yellow-500/20'
                        : 'bg-yellow-50 border border-yellow-200'
                    }`}>
                      <h4 className={`text-sm font-medium mb-2 ${
                        theme === 'gold' ? 'text-yellow-400' : 'text-yellow-700'
                      }`}>
                        🔒 Security & Compliance
                      </h4>
                      <ul className={`text-sm space-y-1 ${
                        theme === 'gold' ? 'text-yellow-300' : 'text-yellow-600'
                      }`}>
                        <li>• Credentials are encrypted at rest using AES-256</li>
                        <li>• Only you can access your stored credentials</li>
                        <li>• Verification is rate-limited to prevent abuse</li>
                        <li>• You can revoke access anytime by deleting credentials</li>
                        <li>• We only access data you're entitled to see</li>
                      </ul>
                    </div>

                    <div className={`p-4 rounded-lg ${
                      theme === 'gold'
                        ? 'bg-gray-500/10 border border-gray-500/20'
                        : 'bg-gray-50 border border-gray-200'
                    }`}>
                      <h4 className={`text-sm font-medium mb-2 ${
                        theme === 'gold' ? 'text-gray-400' : 'text-gray-700'
                      }`}>
                        🔧 Troubleshooting
                      </h4>
                      <ul className={`text-sm space-y-1 ${
                        theme === 'gold' ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        <li>• <strong>Verification fails:</strong> Check if you're logged in to {selectedActor.targetDomain}</li>
                        <li>• <strong>Cookies expire:</strong> Re-capture cookies after logging in again</li>
                        <li>• <strong>Rate limited:</strong> Wait before trying verification again</li>
                        <li>• <strong>Auto-capture blocked:</strong> Use manual setup as fallback</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className={`p-6 rounded-xl border ${
          theme === 'gold' 
            ? 'black-card gold-border' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${
              theme === 'gold' ? 'bg-blue-500/20' : 'bg-blue-100'
            }`}>
              <Database className={`h-6 w-6 ${
                theme === 'gold' ? 'text-blue-400' : 'text-blue-600'
              }`} />
            </div>
            <div className="ml-4">
              <p className={`text-2xl font-bold ${
                theme === 'gold' ? 'text-yellow-400' : 'text-gray-900'
              }`}>
                {ACTOR_REGISTRY.length}
              </p>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Available Integrations
              </p>
            </div>
          </div>
        </div>

        <div className={`p-6 rounded-xl border ${
          theme === 'gold' 
            ? 'black-card gold-border' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${
              theme === 'gold' ? 'bg-green-500/20' : 'bg-green-100'
            }`}>
              <CheckCircle className={`h-6 w-6 ${
                theme === 'gold' ? 'text-green-400' : 'text-green-600'
              }`} />
            </div>
            <div className="ml-4">
              <p className={`text-2xl font-bold ${
                theme === 'gold' ? 'text-yellow-400' : 'text-gray-900'
              }`}>
                {userCredentials.filter(c => c.status === 'connected').length}
              </p>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Connected
              </p>
            </div>
          </div>
        </div>

        <div className={`p-6 rounded-xl border ${
          theme === 'gold' 
            ? 'black-card gold-border' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${
              theme === 'gold' ? 'bg-yellow-500/20' : 'bg-yellow-100'
            }`}>
              <AlertTriangle className={`h-6 w-6 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-yellow-600'
              }`} />
            </div>
            <div className="ml-4">
              <p className={`text-2xl font-bold ${
                theme === 'gold' ? 'text-yellow-400' : 'text-gray-900'
              }`}>
                {userCredentials.filter(c => c.status === 'failed' || c.status === 'expired').length}
              </p>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Need Attention
              </p>
            </div>
          </div>
        </div>

        <div className={`p-6 rounded-xl border ${
          theme === 'gold' 
            ? 'black-card gold-border' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${
              theme === 'gold' ? 'bg-purple-500/20' : 'bg-purple-100'
            }`}>
              <Lock className={`h-6 w-6 ${
                theme === 'gold' ? 'text-purple-400' : 'text-purple-600'
              }`} />
            </div>
            <div className="ml-4">
              <p className={`text-2xl font-bold ${
                theme === 'gold' ? 'text-yellow-400' : 'text-gray-900'
              }`}>
                {userCredentials.length}
              </p>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Total Stored
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}