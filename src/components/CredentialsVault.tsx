import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { LoadingSpinner } from './common/LoadingSpinner';
import { ErrorMessage } from './common/ErrorMessage';
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
  X
} from 'lucide-react';

interface Actor {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  requires_cookies: boolean;
  requires_user_agent: boolean;
  verify_endpoint: string | null;
  verify_hint: string | null;
  scopes: string[];
  is_active: boolean;
}

interface ActorField {
  id: string;
  actor_slug: string;
  field_key: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  is_masked: boolean;
  placeholder: string | null;
  helper_text: string | null;
  validation_regex: string | null;
  field_order: number;
}

interface UserCredential {
  id: string;
  actor_slug: string;
  status: string;
  last_verified_at: string | null;
  verification_attempts: number;
  expires_at: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
}

interface CredentialForm {
  [key: string]: string;
}

export function CredentialsVault() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [actors, setActors] = useState<Actor[]>([]);
  const [userCredentials, setUserCredentials] = useState<UserCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedActor, setSelectedActor] = useState<Actor | null>(null);
  const [actorFields, setActorFields] = useState<ActorField[]>([]);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [formData, setFormData] = useState<CredentialForm>({});
  const [showRawCookies, setShowRawCookies] = useState(false);
  const [rawCookieString, setRawCookieString] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [actorsResponse, credentialsResponse] = await Promise.all([
        supabase
          .from('actor_registry')
          .select('*')
          .eq('is_active', true)
          .order('category, title'),
        supabase
          .from('user_credentials')
          .select('*')
          .eq('user_id', user?.id)
          .order('updated_at', { ascending: false })
      ]);

      if (actorsResponse.error) throw actorsResponse.error;
      if (credentialsResponse.error) throw credentialsResponse.error;

      setActors(actorsResponse.data || []);
      setUserCredentials(credentialsResponse.data || []);
    } catch (error) {
      console.error('Error fetching vault data:', error);
      setError('Failed to load credentials vault');
    } finally {
      setLoading(false);
    }
  };

  const fetchActorFields = async (actorSlug: string) => {
    try {
      const { data, error } = await supabase
        .from('actor_fields')
        .select('*')
        .eq('actor_slug', actorSlug)
        .order('field_order');

      if (error) throw error;
      setActorFields(data || []);
    } catch (error) {
      console.error('Error fetching actor fields:', error);
    }
  };

  const handleConnectActor = async (actor: Actor) => {
    setSelectedActor(actor);
    setFormData({});
    setRawCookieString('');
    setShowRawCookies(false);
    await fetchActorFields(actor.slug);
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
    if (!rawCookieString.trim()) return;
    
    const parsedCookies = parseCookieString(rawCookieString);
    const newFormData = { ...formData };
    
    // Map parsed cookies to form fields
    actorFields.forEach(field => {
      if (field.field_type === 'cookie' && parsedCookies[field.field_key]) {
        newFormData[field.field_key] = parsedCookies[field.field_key];
      }
    });
    
    setFormData(newFormData);
  };

  const handleSaveCredentials = async () => {
    if (!selectedActor || !user) return;

    setSaving(true);
    try {
      // Validate required fields
      const missingFields = actorFields
        .filter(field => field.is_required && !formData[field.field_key]?.trim())
        .map(field => field.field_label);

      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Prepare credential payload
      const credentialPayload = {
        actor_slug: selectedActor.slug,
        fields: formData,
        user_agent: formData.user_agent || navigator.userAgent,
        created_at: new Date().toISOString()
      };

      // Call edge function to encrypt and store
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-credentials`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          actor_slug: selectedActor.slug,
          payload: credentialPayload
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save credentials');
      }

      setShowConnectModal(false);
      fetchData();
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
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-credentials`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user?.id,
          actor_slug: actorSlug
        }),
      });

      if (!response.ok) {
        throw new Error('Verification failed');
      }

      fetchData();
    } catch (error) {
      console.error('Error verifying credentials:', error);
    } finally {
      setTesting(null);
    }
  };

  const handleDeleteCredentials = async (actorSlug: string) => {
    if (!confirm('Are you sure you want to delete these credentials?')) return;

    try {
      const { error } = await supabase
        .from('user_credentials')
        .delete()
        .eq('user_id', user?.id)
        .eq('actor_slug', actorSlug);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error deleting credentials:', error);
      setError('Failed to delete credentials');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return CheckCircle;
      case 'failed':
      case 'expired':
        return XCircle;
      case 'disabled':
        return Lock;
      default:
        return AlertTriangle;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return theme === 'gold' ? 'text-green-400' : 'text-green-600';
      case 'failed':
      case 'expired':
        return theme === 'gold' ? 'text-red-400' : 'text-red-600';
      case 'disabled':
        return theme === 'gold' ? 'text-gray-400' : 'text-gray-600';
      default:
        return theme === 'gold' ? 'text-yellow-400' : 'text-yellow-600';
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
      case 'business':
        return '🏢';
      case 'community':
        return '💬';
      default:
        return '⚙️';
    }
  };

  const filteredActors = actors.filter(actor => {
    const matchesSearch = !searchTerm || 
      actor.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      actor.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = !selectedCategory || actor.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(actors.map(actor => actor.category))];

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
            Securely manage cookies and API keys for {actors.length} scraping actors
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
              key={actor.id}
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
                      {actor.description}
                    </p>
                  </div>
                </div>
                
                {/* Status */}
                <div className="flex items-center space-x-2">
                  <StatusIcon className={`h-5 w-5 ${getStatusColor(credential?.status || 'unverified')}`} />
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    credential?.status === 'active'
                      ? theme === 'gold' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-800'
                      : credential?.status === 'failed' || credential?.status === 'expired'
                      ? theme === 'gold' ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-800'
                      : credential?.status === 'disabled'
                      ? theme === 'gold' ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-800'
                      : theme === 'gold' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {credential?.status || 'Not Connected'}
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
                  {actor.requires_cookies && (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      theme === 'gold'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      <Cookie className="h-3 w-3 inline mr-1" />
                      Cookies
                    </span>
                  )}
                  {actor.requires_user_agent && (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      theme === 'gold'
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      <Code className="h-3 w-3 inline mr-1" />
                      User Agent
                    </span>
                  )}
                  {!actor.requires_cookies && (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      theme === 'gold'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      <Key className="h-3 w-3 inline mr-1" />
                      API Key
                    </span>
                  )}
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
              <div className="flex items-center space-x-2">
                {credential ? (
                  <>
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
                      {testing === actor.slug ? 'Testing...' : 'Test'}
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
                  </>
                ) : (
                  <button
                    onClick={() => handleConnectActor(actor)}
                    className={`w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      theme === 'gold'
                        ? 'gold-gradient text-black hover-gold'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Connect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Connect Modal */}
      {showConnectModal && selectedActor && (
        <div className={`fixed inset-0 z-50 overflow-y-auto ${
          theme === 'gold' ? 'bg-black/75' : 'bg-gray-900/50'
        }`}>
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className={`w-full max-w-2xl rounded-xl shadow-2xl ${
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
                        {selectedActor.description}
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

              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {/* Connection Method Toggle */}
                {selectedActor.requires_cookies && (
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
                        Manual Fields
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
                {showRawCookies && selectedActor.requires_cookies && (
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
                        Chrome: DevTools → Application → Cookies → Copy all cookies
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
                  {actorFields.map((field) => {
                    const isSecret = field.is_masked || field.field_type === 'password' || field.field_type === 'cookie';
                    const showField = showSecrets[field.field_key] || false;
                    
                    return (
                      <div key={field.id}>
                        <label className={`block text-sm font-medium mb-2 ${
                          theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          {field.field_label}
                          {field.is_required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        
                        <div className="relative">
                          {field.field_type === 'textarea' ? (
                            <textarea
                              value={formData[field.field_key] || ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                [field.field_key]: e.target.value
                              }))}
                              rows={3}
                              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                                theme === 'gold'
                                  ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                                  : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                              }`}
                              placeholder={field.placeholder || ''}
                            />
                          ) : (
                            <input
                              type={isSecret && !showField ? 'password' : 'text'}
                              value={formData[field.field_key] || ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                [field.field_key]: e.target.value
                              }))}
                              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                                isSecret ? 'pr-10' : ''
                              } ${
                                theme === 'gold'
                                  ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                                  : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                              }`}
                              placeholder={field.placeholder || ''}
                              required={field.is_required}
                            />
                          )}
                          
                          {isSecret && (
                            <button
                              type="button"
                              onClick={() => setShowSecrets(prev => ({
                                ...prev,
                                [field.field_key]: !showField
                              }))}
                              className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
                                theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                              }`}
                            >
                              {showField ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          )}
                        </div>
                        
                        {field.helper_text && (
                          <p className={`text-xs mt-1 ${
                            theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                          }`}>
                            {field.helper_text}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* How to Get Cookies Guide */}
                {selectedActor.requires_cookies && (
                  <div className={`mt-6 p-4 rounded-lg ${
                    theme === 'gold'
                      ? 'bg-blue-500/10 border border-blue-500/20'
                      : 'bg-blue-50 border border-blue-200'
                  }`}>
                    <h4 className={`text-sm font-medium mb-2 ${
                      theme === 'gold' ? 'text-blue-400' : 'text-blue-700'
                    }`}>
                      🍪 How to Get Your Cookies
                    </h4>
                    <div className={`text-sm space-y-1 ${
                      theme === 'gold' ? 'text-blue-300' : 'text-blue-600'
                    }`}>
                      <p><strong>Chrome:</strong> DevTools (F12) → Application → Cookies → {selectedActor.title}</p>
                      <p><strong>Firefox:</strong> DevTools (F12) → Storage → Cookies → {selectedActor.title}</p>
                      <p><strong>Safari:</strong> Develop → Show Web Inspector → Storage → Cookies</p>
                    </div>
                  </div>
                )}

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
                        Save Credentials
                      </>
                    )}
                  </button>
                </div>
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
              <Shield className={`h-6 w-6 ${
                theme === 'gold' ? 'text-blue-400' : 'text-blue-600'
              }`} />
            </div>
            <div className="ml-4">
              <p className={`text-2xl font-bold ${
                theme === 'gold' ? 'text-yellow-400' : 'text-gray-900'
              }`}>
                {actors.length}
              </p>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Available Actors
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
                {userCredentials.filter(c => c.status === 'active').length}
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