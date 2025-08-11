import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
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
  Crown
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
          budget_max_usd: 8
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
          onLeadsFound();
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return CheckCircle;
      case 'failed':
        return AlertCircle;
      case 'running':
        return Clock;
      default:
        return Clock;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
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
                  className={`p-4 rounded-lg border ${
                    theme === 'gold'
                      ? 'border-yellow-400/10 bg-black/10'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <StatusIcon className={`h-4 w-4 ${getStatusColor(run.status)}`} />
                      <span className={`text-sm font-medium ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        {run.goal}
                      </span>
                    </div>
                    <span className={`text-xs ${
                      theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                    }`}>
                      {new Date(run.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-xs">
                      <span className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
                        <Target className="h-3 w-3 inline mr-1" />
                        {run.leads_found} leads
                      </span>
                      <span className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
                        <DollarSign className="h-3 w-3 inline mr-1" />
                        ${run.cost_usd.toFixed(2)}
                      </span>
                      <span className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
                        {run.niche}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-1">
                      {run.signals.slice(0, 2).map((signal, index) => (
                        <span
                          key={index}
                          className={`text-xs px-2 py-1 rounded-full ${
                            theme === 'gold'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {signal}
                        </span>
                      ))}
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
          <li>• Each run costs ~$2-8 and finds 100-300 high-intent leads</li>
        </ul>
      </div>
    </div>
  );
}