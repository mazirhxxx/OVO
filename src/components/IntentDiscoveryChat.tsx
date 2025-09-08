import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { DiscoveredLeadsViewer } from './DiscoveredLeadsViewer';
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  Target, 
  DollarSign, 
  Play, 
  CheckCircle,
  AlertCircle,
  Clock,
  BarChart3,
  Zap,
  Crown,
  Shield,
  Cookie,
  Key,
  Eye,
  EyeOff,
  Copy,
  Settings,
  Plus,
  Trash2,
  X
} from 'lucide-react';

interface IntentRun {
  id: string;
  goal: string;
  niche: string;
  signals: string[];
  actors_used: string[];
  leads_found: number;
  cost_usd: number;
  status: string;
  created_at: string;
  completed_at: string | null;
  credentials?: Record<string, any>;
  actors_config?: Record<string, any>;
}

interface IntentDiscoveryChatProps {
  onLeadsFound: () => void;
}

export function IntentDiscoveryChat({ onLeadsFound }: IntentDiscoveryChatProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [message, setMessage] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [recentRuns, setRecentRuns] = useState<IntentRun[]>([]);
  const [currentRun, setCurrentRun] = useState<IntentRun | null>(null);
  const [showDiscoveredLeads, setShowDiscoveredLeads] = useState(false);
  const [selectedRunForViewing, setSelectedRunForViewing] = useState<string>('');
  const [showCredentials, setShowCredentials] = useState(false);
  const [credentials, setCredentials] = useState<Record<string, any>>({});
  const [selectedActors, setSelectedActors] = useState<string[]>([
    'linkedin-basic',
    'x-twitter',
    'google-maps',
    'indeed-jobs'
  ]);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // Actor definitions
  const actors = {
    'linkedin-basic': {
      title: 'LinkedIn Basic',
      category: 'social',
      icon: '💼',
      requiresCookies: true,
      fields: [
        { key: 'li_at', label: 'li_at Cookie', type: 'password', required: true },
        { key: 'JSESSIONID', label: 'JSESSIONID', type: 'password', required: true }
      ],
      helper: 'Chrome: DevTools → Application → Cookies → linkedin.com'
    },
    'linkedin-sales-navigator': {
      title: 'Sales Navigator',
      category: 'social',
      icon: '🎯',
      requiresCookies: true,
      fields: [
        { key: 'li_at', label: 'li_at Cookie', type: 'password', required: true },
        { key: 'JSESSIONID', label: 'JSESSIONID', type: 'password', required: true },
        { key: 'li_a', label: 'li_a Cookie', type: 'password', required: false }
      ],
      helper: 'Chrome: DevTools → Application → Cookies → linkedin.com'
    },
    'x-twitter': {
      title: 'X (Twitter)',
      category: 'social',
      icon: '🐦',
      requiresCookies: true,
      fields: [
        { key: 'auth_token', label: 'auth_token', type: 'password', required: true },
        { key: 'ct0', label: 'ct0 (CSRF Token)', type: 'password', required: true }
      ],
      helper: 'Chrome: DevTools → Application → Cookies → twitter.com'
    },
    'facebook-groups': {
      title: 'Facebook Groups',
      category: 'social',
      icon: '👥',
      requiresCookies: true,
      fields: [
        { key: 'c_user', label: 'c_user', type: 'password', required: true },
        { key: 'xs', label: 'xs Cookie', type: 'password', required: true },
        { key: 'fr', label: 'fr Cookie', type: 'password', required: true }
      ],
      helper: 'Chrome: DevTools → Application → Cookies → facebook.com'
    },
    'instagram-basic': {
      title: 'Instagram',
      category: 'social',
      icon: '📸',
      requiresCookies: true,
      fields: [
        { key: 'sessionid', label: 'sessionid', type: 'password', required: true },
        { key: 'csrftoken', label: 'csrftoken', type: 'password', required: true }
      ],
      helper: 'Chrome: DevTools → Application → Cookies → instagram.com'
    },
    'reddit-auth': {
      title: 'Reddit',
      category: 'social',
      icon: '🤖',
      requiresCookies: true,
      fields: [
        { key: 'reddit_session', label: 'reddit_session', type: 'password', required: true }
      ],
      helper: 'Chrome: DevTools → Application → Cookies → reddit.com'
    },
    'google-maps': {
      title: 'Google Maps',
      category: 'maps',
      icon: '🗺️',
      requiresCookies: true,
      fields: [
        { key: 'SAPISID', label: 'SAPISID', type: 'password', required: true },
        { key: '__Secure-3PSAPISID', label: '__Secure-3PSAPISID', type: 'password', required: true }
      ],
      helper: 'Chrome: DevTools → Application → Cookies → maps.google.com'
    },
    'indeed-jobs': {
      title: 'Indeed Jobs',
      category: 'jobs',
      icon: '💼',
      requiresCookies: true,
      fields: [
        { key: 'CTK', label: 'CTK Session', type: 'password', required: true }
      ],
      helper: 'Chrome: DevTools → Application → Cookies → indeed.com'
    },
    'glassdoor': {
      title: 'Glassdoor',
      category: 'jobs',
      icon: '🏢',
      requiresCookies: true,
      fields: [
        { key: 'GDSession', label: 'GDSession', type: 'password', required: true },
        { key: 'TS01ac2299', label: 'TS Cookie', type: 'password', required: true }
      ],
      helper: 'Chrome: DevTools → Application → Cookies → glassdoor.com'
    },
    'apollo-portal': {
      title: 'Apollo.io',
      category: 'enrichment',
      icon: '🚀',
      requiresCookies: false,
      fields: [
        { key: 'api_key', label: 'API Key', type: 'password', required: true }
      ],
      helper: 'Get from Apollo.io dashboard → Settings → API'
    },
    'hunter-io': {
      title: 'Hunter.io',
      category: 'enrichment',
      icon: '🔍',
      requiresCookies: false,
      fields: [
        { key: 'api_key', label: 'API Key', type: 'password', required: true }
      ],
      helper: 'Get from Hunter.io dashboard → API tab'
    },
    'people-data-labs': {
      title: 'People Data Labs',
      category: 'enrichment',
      icon: '👥',
      requiresCookies: false,
      fields: [
        { key: 'api_key', label: 'API Key', type: 'password', required: true }
      ],
      helper: 'Get from PDL dashboard → API Keys'
    },
    'dropcontact': {
      title: 'Dropcontact',
      category: 'enrichment',
      icon: '📧',
      requiresCookies: false,
      fields: [
        { key: 'api_key', label: 'API Key', type: 'password', required: true }
      ],
      helper: 'Get from Dropcontact dashboard → API'
    },
    'serper-bing': {
      title: 'Serper (Bing)',
      category: 'search',
      icon: '🔎',
      requiresCookies: false,
      fields: [
        { key: 'api_key', label: 'API Key', type: 'password', required: true }
      ],
      helper: 'Get from Serper.dev dashboard'
    },
    'github-scraper': {
      title: 'GitHub',
      category: 'developer',
      icon: '👨‍💻',
      requiresCookies: true,
      fields: [
        { key: 'user_session', label: 'user_session', type: 'password', required: true }
      ],
      helper: 'Chrome: DevTools → Application → Cookies → github.com'
    }
  };

  useEffect(() => {
    if (user) {
      fetchRecentRuns();
    }
  }, [user]);

  const fetchRecentRuns = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('intent_runs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        // Handle missing table gracefully
        if (error.code === '42P01') {
          console.warn('Intent runs table not yet created');
          setRecentRuns([]);
          return;
        }
        throw error;
      }
      setRecentRuns(data || []);
    } catch (error) {
      console.error('Error fetching recent runs:', error);
      setRecentRuns([]);
    }
  };

  const startIntentDiscovery = async () => {
    if (!user || !message.trim()) return;

    setIsRunning(true);
    
    try {
      // Parse the user's intent from their message
      const goal = message.trim();
      const niche = extractNiche(message);
      const signals = extractSignals(message);
      
      // Create intent run record
      const { data: runData, error: runError } = await supabase
        .from('intent_runs')
        .insert([{
          user_id: user.id,
          goal,
          niche,
          signals,
          seed_queries: [message],
          status: 'running',
          budget_max_usd: 8,
          credentials: Object.keys(credentials).length > 0 ? credentials : null,
          actors_config: {
            selected_actors: selectedActors,
            actors_used: selectedActors
          }
        }])
        .select()
        .single();

      if (runError) throw runError;
      
      setCurrentRun(runData);

      // Call the orchestrator webhook
      const response = await fetch('https://hook.eu2.make.com/your-orchestrator-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaign_id: `intent_${runData.id}`,
          user_id: user.id,
          goal,
          niche,
          signals,
          seed_queries: [message],
          credentials: Object.keys(credentials).length > 0 ? credentials : null,
          selected_actors: selectedActors,
          actors_allow: ["twitter_search_ppr", "reddit_members", "places_yelp", "jobs_indeed"],
          top_k: 300,
          budget: { max_usd: 8 },
          explore_ratio: 0.10
        }),
      });

      if (response.ok) {
        // Poll for completion
        pollForCompletion(runData.id);
      } else {
        throw new Error('Failed to start intent discovery');
      }

      setMessage('');
    } catch (error) {
      console.error('Error starting intent discovery:', error);
      setIsRunning(false);
      
      // Update run status to failed
      if (currentRun) {
        await supabase
          .from('intent_runs')
          .update({ 
            status: 'failed', 
            error_message: error instanceof Error ? error.message : 'Unknown error',
            completed_at: new Date().toISOString()
          })
          .eq('id', currentRun.id);
      }
    }
  };

  const pollForCompletion = async (runId: string) => {
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;

    const poll = async () => {
      try {
        const { data, error } = await supabase
          .from('intent_runs')
          .select('*')
          .eq('id', runId)
          .single();

        if (error) throw error;

        setCurrentRun(data);

        if (data.status === 'completed') {
          setIsRunning(false);
          fetchRecentRuns();
          
          // Auto-create list from discovered leads
          if (data.leads_found > 0) {
            await createListFromDiscoveredLeads(runId, data.goal);
          }
          
          onLeadsFound();
          setSelectedRunForViewing(runId);
          setShowDiscoveredLeads(true);
          return;
        }

        if (data.status === 'failed') {
          setIsRunning(false);
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Poll every 5 seconds
        } else {
          setIsRunning(false);
        }
      } catch (error) {
        console.error('Error polling run status:', error);
        setIsRunning(false);
      }
    };

    poll();
  };

  const createListFromDiscoveredLeads = async (runId: string, goal: string) => {
    if (!user) return;

    try {
      // Create a new list for this discovery run
      const listName = `Discovery: ${goal.substring(0, 50)}${goal.length > 50 ? '...' : ''}`;
      const listDescription = `Auto-generated from discovery run on ${new Date().toLocaleDateString()}. Goal: ${goal}`;
      
      const { data: newList, error: listError } = await supabase
        .from('lists')
        .insert([{
          user_id: user.id,
          name: listName,
          description: listDescription,
          tags: ['discovery', 'auto-generated']
        }])
        .select()
        .single();

      if (listError) throw listError;

      // Get discovered leads from this run
      const { data: discoveredLeads, error: leadsError } = await supabase
        .from('discovered_leads')
        .select('*')
        .eq('intent_run_id', runId)
        .eq('user_id', user.id);

      if (leadsError) throw leadsError;

      if (discoveredLeads && discoveredLeads.length > 0) {
        // Transform discovered leads to list leads format
        const listLeads = discoveredLeads.map(lead => ({
          list_id: newList.id,
          user_id: user.id,
          name: lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown Lead',
          email: lead.email,
          phone: lead.phone,
          company_name: lead.company,
          job_title: lead.title,
          source_url: lead.linkedin_url,
          source_platform: lead.source_slug || 'discovery',
          custom_fields: {
            intent_score: lead.intent_score,
            tags: lead.tags || [],
            reasons: lead.reasons || [],
            country: lead.country,
            state: lead.state,
            city: lead.city,
            company_domain: lead.company_domain,
            discovery_run_id: runId
          }
        }));

        // Insert leads into the new list in batches
        const batchSize = 50;
        for (let i = 0; i < listLeads.length; i += batchSize) {
          const batch = listLeads.slice(i, i + batchSize);
          const { error: insertError } = await supabase
            .from('list_leads')
            .insert(batch);

          if (insertError) {
            console.error('Error inserting batch:', insertError);
            // Continue with next batch even if one fails
          }
        }

        console.log(`Created list "${listName}" with ${listLeads.length} discovered leads`);
      }
    } catch (error) {
      console.error('Error creating list from discovered leads:', error);
      // Don't fail the whole process if list creation fails
    }
  };

  const extractNiche = (text: string): string => {
    const niches = ['SaaS', 'E-commerce', 'Healthcare', 'Fintech', 'EdTech', 'PropTech', 'MarTech'];
    const found = niches.find(niche => 
      text.toLowerCase().includes(niche.toLowerCase())
    );
    return found || 'General';
  };

  const extractSignals = (text: string): string[] => {
    const signalKeywords = {
      'hiring': ['hiring', 'recruiting', 'looking for', 'need help'],
      'funding': ['funding', 'raised', 'investment', 'series'],
      'growth': ['scaling', 'growing', 'expanding', 'growth'],
      'pain': ['struggling', 'problem', 'issue', 'challenge'],
      'budget': ['budget', 'spend', 'invest', 'cost']
    };

    const signals: string[] = [];
    Object.entries(signalKeywords).forEach(([signal, keywords]) => {
      if (keywords.some(keyword => text.toLowerCase().includes(keyword))) {
        signals.push(signal);
      }
    });

    return signals.length > 0 ? signals : ['general_intent'];
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

  const handleCredentialChange = (actorSlug: string, field: string, value: string) => {
    setCredentials(prev => ({
      ...prev,
      [actorSlug]: {
        ...prev[actorSlug],
        [field]: value
      }
    }));
  };

  const handleRawCookiesParse = (actorSlug: string, rawCookies: string) => {
    const parsedCookies = parseCookieString(rawCookies);
    const actor = actors[actorSlug as keyof typeof actors];
    
    if (actor) {
      const actorCredentials: Record<string, string> = {};
      actor.fields.forEach(field => {
        if (parsedCookies[field.key]) {
          actorCredentials[field.key] = parsedCookies[field.key];
        }
      });
      
      setCredentials(prev => ({
        ...prev,
        [actorSlug]: {
          ...prev[actorSlug],
          ...actorCredentials,
          user_agent: navigator.userAgent
        }
      }));
    }
  };

  const getCredentialStatus = (actorSlug: string) => {
    const actorCreds = credentials[actorSlug];
    if (!actorCreds) return 'not_connected';
    
    const actor = actors[actorSlug as keyof typeof actors];
    if (!actor) return 'not_connected';
    
    const requiredFields = actor.fields.filter(f => f.required);
    const hasAllRequired = requiredFields.every(field => actorCreds[field.key]?.trim());
    
    return hasAllRequired ? 'connected' : 'incomplete';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return CheckCircle;
      case 'incomplete':
        return AlertCircle;
      default:
        return Clock;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return theme === 'gold' ? 'text-green-400' : 'text-green-600';
      case 'incomplete':
        return theme === 'gold' ? 'text-yellow-400' : 'text-yellow-600';
      case 'completed':
        return theme === 'gold' ? 'text-green-400' : 'text-green-600';
      case 'failed':
        return theme === 'gold' ? 'text-red-400' : 'text-red-600';
      case 'running':
        return theme === 'gold' ? 'text-yellow-400' : 'text-yellow-600';
      default:
        return theme === 'gold' ? 'text-gray-400' : 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Chat Interface */}
      <div className={`p-6 rounded-lg border ${
        theme === 'gold'
          ? 'border-yellow-400/20 bg-black/20'
          : 'border-gray-200 bg-gray-50'
      }`}>
        <div className="flex items-center space-x-3 mb-4">
          {theme === 'gold' ? (
            <Crown className="h-6 w-6 text-yellow-400" />
          ) : (
            <Sparkles className="h-6 w-6 text-blue-600" />
          )}
          <h3 className={`text-lg font-semibold ${
            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
          }`}>
            AI Intent Discovery
          </h3>
        </div>
        
        <p className={`text-sm mb-6 ${
          theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          Describe what type of leads you're looking for, and our AI will find prospects with buying intent across multiple platforms.
        </p>

        {/* Credentials Section */}
        <div className={`mb-6 p-4 rounded-lg border ${
          theme === 'gold'
            ? 'border-yellow-400/20 bg-yellow-400/5'
            : 'border-blue-200 bg-blue-50'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Shield className={`h-5 w-5 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
              }`} />
              <h4 className={`text-sm font-medium ${
                theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
              }`}>
                Scraping Credentials ({Object.keys(credentials).length}/{selectedActors.length})
              </h4>
            </div>
            <button
              onClick={() => setShowCredentials(!showCredentials)}
              className={`text-sm ${
                theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
              } hover:underline`}
            >
              {showCredentials ? 'Hide' : 'Setup Credentials'}
            </button>
          </div>

          {/* Actor Status Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {selectedActors.map(actorSlug => {
              const actor = actors[actorSlug as keyof typeof actors];
              const status = getCredentialStatus(actorSlug);
              const StatusIcon = getStatusIcon(status);
              
              return (
                <div
                  key={actorSlug}
                  className={`p-3 rounded-lg border ${
                    status === 'connected'
                      ? theme === 'gold'
                        ? 'border-green-500/30 bg-green-500/10'
                        : 'border-green-200 bg-green-50'
                      : theme === 'gold'
                        ? 'border-gray-600 bg-gray-800/50'
                        : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{actor?.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-medium truncate ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        {actor?.title}
                      </div>
                      <div className="flex items-center space-x-1">
                        <StatusIcon className={`h-3 w-3 ${getStatusColor(status)}`} />
                        <span className={`text-xs ${getStatusColor(status)}`}>
                          {status === 'connected' ? 'Ready' : status === 'incomplete' ? 'Setup' : 'Not Set'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Credentials Setup */}
          {showCredentials && (
            <div className="space-y-4">
              {selectedActors.map(actorSlug => {
                const actor = actors[actorSlug as keyof typeof actors];
                const actorCreds = credentials[actorSlug] || {};
                
                return (
                  <div
                    key={actorSlug}
                    className={`p-4 rounded-lg border ${
                      theme === 'gold'
                        ? 'border-yellow-400/20 bg-black/20'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center space-x-3 mb-4">
                      <span className="text-xl">{actor?.icon}</span>
                      <div>
                        <h5 className={`font-medium ${
                          theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                        }`}>
                          {actor?.title}
                        </h5>
                        <p className={`text-xs ${
                          theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                        }`}>
                          {actor?.helper}
                        </p>
                      </div>
                    </div>

                    {/* Raw Cookie String Input */}
                    {actor?.requiresCookies && (
                      <div className="mb-4">
                        <label className={`block text-xs font-medium mb-2 ${
                          theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Paste Raw Cookie String (Quick Setup)
                        </label>
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            placeholder="Paste browser cookies here..."
                            className={`flex-1 px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 ${
                              theme === 'gold'
                                ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                                : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                            }`}
                            onPaste={(e) => {
                              const pastedText = e.clipboardData.getData('text');
                              handleRawCookiesParse(actorSlug, pastedText);
                            }}
                          />
                          <button
                            onClick={() => {
                              const input = document.querySelector(`input[placeholder="Paste browser cookies here..."]`) as HTMLInputElement;
                              if (input?.value) {
                                handleRawCookiesParse(actorSlug, input.value);
                                input.value = '';
                              }
                            }}
                            className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                              theme === 'gold'
                                ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                                : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            Parse
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Individual Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {actor?.fields.map(field => {
                        const isSecret = field.type === 'password';
                        const showField = showSecrets[`${actorSlug}-${field.key}`] || false;
                        
                        return (
                          <div key={field.key}>
                            <label className={`block text-xs font-medium mb-1 ${
                              theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                              {field.label}
                              {field.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            <div className="relative">
                              <input
                                type={isSecret && !showField ? 'password' : 'text'}
                                value={actorCreds[field.key] || ''}
                                onChange={(e) => handleCredentialChange(actorSlug, field.key, e.target.value)}
                                className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 ${
                                  isSecret ? 'pr-8' : ''
                                } ${
                                  theme === 'gold'
                                    ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                                    : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                                }`}
                                placeholder={field.key}
                              />
                              {isSecret && (
                                <button
                                  type="button"
                                  onClick={() => setShowSecrets(prev => ({
                                    ...prev,
                                    [`${actorSlug}-${field.key}`]: !showField
                                  }))}
                                  className={`absolute right-2 top-1/2 transform -translate-y-1/2 ${
                                    theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                                  }`}
                                >
                                  {showField ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* User Agent Field */}
                      <div className="md:col-span-2">
                        <label className={`block text-xs font-medium mb-1 ${
                          theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          User Agent
                        </label>
                        <input
                          type="text"
                          value={actorCreds.user_agent || navigator.userAgent}
                          onChange={(e) => handleCredentialChange(actorSlug, 'user_agent', e.target.value)}
                          className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 ${
                            theme === 'gold'
                              ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                              : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                          }`}
                          placeholder="Browser user agent"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className={`text-xs ${
            theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
          }`}>
            💡 Credentials are stored securely and only used for this discovery run
          </div>
        </div>

        {/* Discovered Leads Viewer Modal */}
        {showDiscoveredLeads && selectedRunForViewing && (
          <div className={`fixed inset-0 z-50 overflow-y-auto ${
            theme === 'gold' ? 'bg-black/75' : 'bg-gray-900/50'
          }`}>
            <div className="flex items-center justify-center min-h-screen p-4">
              <div className={`w-full max-w-7xl rounded-xl shadow-2xl ${
                theme === 'gold' ? 'black-card gold-border' : 'bg-white border border-gray-200'
              }`}>
                <div className={`p-6 border-b ${
                  theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <h2 className={`text-xl font-bold ${
                      theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                    }`}>
                      Discovered Leads Results
                    </h2>
                    <button
                      onClick={() => setShowDiscoveredLeads(false)}
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
                
                <div className="p-6 max-h-[80vh] overflow-y-auto">
                  <DiscoveredLeadsViewer 
                    intentRunId={selectedRunForViewing}
                    onAddToList={(selectedLeads) => {
                      console.log('Adding leads to list:', selectedLeads);
                      // This could open another modal to select which list to add to
                      setShowDiscoveredLeads(false);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Current Run Status */}
        {currentRun && isRunning && (
          <div className={`mb-6 p-4 rounded-lg border ${
            theme === 'gold'
              ? 'border-blue-500/30 bg-blue-500/10'
              : 'border-blue-200 bg-blue-50'
          }`}>
            <div className="flex items-center space-x-3">
              <div className={`animate-spin rounded-full h-5 w-5 border-2 border-transparent ${
                theme === 'gold' ? 'border-t-yellow-400' : 'border-t-blue-600'
              }`}></div>
              <div>
                <div className={`text-sm font-medium ${
                  theme === 'gold' ? 'text-blue-400' : 'text-blue-700'
                }`}>
                  Discovering leads...
                </div>
                <div className={`text-xs ${
                  theme === 'gold' ? 'text-blue-300' : 'text-blue-600'
                }`}>
                  Goal: {currentRun.goal}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chat Input */}
        <div className="space-y-4">
          <div className="relative">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  startIntentDiscovery();
                }
              }}
              rows={3}
              className={`w-full px-4 py-3 pr-12 border rounded-lg focus:outline-none focus:ring-2 resize-none ${
                theme === 'gold'
                  ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                  : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
              }`}
              placeholder="e.g., Find SaaS founders who are hiring marketing agencies and have raised funding recently..."
              disabled={isRunning}
            />
            <button
              onClick={startIntentDiscovery}
              disabled={isRunning || !message.trim()}
              className={`absolute bottom-3 right-3 p-2 rounded-lg transition-colors ${
                theme === 'gold'
                  ? 'gold-gradient text-black hover-gold'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isRunning ? (
                <div className={`animate-spin rounded-full h-4 w-4 border-2 border-transparent ${
                  theme === 'gold' ? 'border-t-black' : 'border-t-white'
                }`}></div>
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Example Queries */}
          <div className="flex flex-wrap gap-2">
            {[
              "Find SaaS founders hiring marketing help",
              "E-commerce companies with growth signals",
              "Healthcare startups raising funding",
              "Fintech companies posting job openings"
            ].map((example, index) => (
              <button
                key={index}
                onClick={() => setMessage(example)}
                disabled={isRunning}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  theme === 'gold'
                    ? 'border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                } disabled:opacity-50`}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Runs */}
      {recentRuns.length > 0 && (
        <div className={`p-6 rounded-lg border ${
          theme === 'gold'
            ? 'border-yellow-400/20 bg-black/20'
            : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex items-center space-x-3 mb-4">
            <BarChart3 className={`h-5 w-5 ${
              theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
            }`} />
            <h4 className={`text-lg font-semibold ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              Recent Discovery Runs
            </h4>
          </div>

          <div className="space-y-3">
            {recentRuns.map((run) => {
              const StatusIcon = getStatusIcon(run.status);
              return (
                <div
                  key={run.id}
                  className={`p-4 rounded-lg border overflow-hidden ${
                    theme === 'gold'
                      ? 'border-yellow-400/10 bg-black/10'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2 gap-3">
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      <StatusIcon className={`h-4 w-4 ${getStatusColor(run.status)}`} />
                      <span className={`text-sm font-medium truncate ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        {run.goal.length > 80 ? `${run.goal.substring(0, 80)}...` : run.goal}
                      </span>
                    </div>
                    <span className={`text-xs whitespace-nowrap flex-shrink-0 ${
                      theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                    }`}>
                      {new Date(run.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center space-x-3 text-xs flex-wrap">
                      <span className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
                        <Target className="h-3 w-3 inline mr-1" />
                        {run.leads_found} leads
                      </span>
                      <span className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
                        <DollarSign className="h-3 w-3 inline mr-1" />
                        ${run.cost_usd.toFixed(2)}
                      </span>
                      <span className={`${theme === 'gold' ? 'text-gray-400' : 'text-gray-600'} truncate max-w-20`}>
                        {run.niche}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-1 justify-end items-center">
                      {run.status === 'completed' && run.leads_found > 0 && (
                        <button
                          onClick={() => {
                            setSelectedRunForViewing(run.id);
                            setShowDiscoveredLeads(true);
                          }}
                          className={`text-xs px-2 py-1 rounded-full transition-colors ${
                            theme === 'gold'
                              ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          }`}
                        >
                          View {run.leads_found} Leads
                        </button>
                      )}
                      {run.signals.slice(0, 2).map((signal, index) => (
                        <span
                          key={index}
                          className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                            theme === 'gold'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {signal.length > 12 ? `${signal.substring(0, 12)}...` : signal}
                        </span>
                      ))}
                      {run.signals.length > 2 && (
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          theme === 'gold'
                            ? 'bg-gray-500/20 text-gray-400'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          +{run.signals.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Discovery Tips */}
      <div className={`p-4 rounded-lg ${
        theme === 'gold'
          ? 'bg-yellow-400/10 border border-yellow-400/20'
          : 'bg-blue-50 border border-blue-200'
      }`}>
        <h4 className={`text-sm font-medium mb-2 ${
          theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
        }`}>
          💡 Discovery Tips
        </h4>
        <ul className={`text-sm space-y-1 ${
          theme === 'gold' ? 'text-yellow-300' : 'text-blue-600'
        }`}>
          <li>• Be specific about industry and role (e.g., "SaaS founders", "Marketing directors")</li>
          <li>• Include buying signals (e.g., "hiring", "raised funding", "looking for")</li>
          <li>• Mention pain points or needs (e.g., "struggling with lead gen")</li>
          <li>• Add credentials above to unlock premium data sources</li>
          <li>• Each run costs ~$2-8 and finds 100-300 high-intent leads</li>
        </ul>
      </div>
    </div>
  );
}