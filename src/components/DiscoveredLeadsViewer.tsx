import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { LoadingSpinner } from './common/LoadingSpinner';
import { ErrorMessage } from './common/ErrorMessage';
import { 
  Users, 
  Search, 
  Filter, 
  Eye, 
  Download, 
  Send, 
  Star,
  Building,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Crown,
  Zap,
  Target,
  BarChart3,
  CheckCircle,
  Plus
} from 'lucide-react';

interface DiscoveredLead {
  id: string;
  intent_run_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  title: string | null;
  linkedin_url: string | null;
  phone: string | null;
  company: string | null;
  company_domain: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  source_slug: string | null;
  intent_score: number;
  tags: string[];
  reasons: string[];
  raw: any;
  created_at: string;
}

interface IntentRun {
  id: string;
  goal: string;
  niche: string;
  leads_found: number;
  cost_usd: number;
  status: string;
  created_at: string;
  completed_at: string | null;
}

interface DiscoveredLeadsViewerProps {
  intentRunId?: string;
  onAddToList?: (leads: DiscoveredLead[]) => void;
}

export function DiscoveredLeadsViewer({ intentRunId, onAddToList }: DiscoveredLeadsViewerProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [leads, setLeads] = useState<DiscoveredLead[]>([]);
  const [intentRuns, setIntentRuns] = useState<IntentRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<string>(intentRunId || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'intent_score' | 'created_at' | 'company'>('intent_score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterBy, setFilterBy] = useState<'all' | 'high_intent' | 'has_email' | 'has_phone'>('all');

  useEffect(() => {
    if (user) {
      fetchIntentRuns();
    }
  }, [user]);

  useEffect(() => {
    if (selectedRun) {
      fetchDiscoveredLeads();
    }
  }, [selectedRun, sortBy, sortOrder]);

  const fetchIntentRuns = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('intent_runs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setIntentRuns(data || []);
      
      // Auto-select the most recent run if no specific run provided
      if (!intentRunId && data && data.length > 0) {
        setSelectedRun(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching intent runs:', error);
      setError('Failed to load discovery runs');
    }
  };

  const fetchDiscoveredLeads = async () => {
    if (!selectedRun || !user) return;

    try {
      setLoading(true);
      
      let query = supabase
        .from('discovered_leads')
        .select('*')
        .eq('intent_run_id', selectedRun)
        .eq('user_id', user.id);

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      const { data, error } = await query;
      if (error) throw error;
      
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching discovered leads:', error);
      setError('Failed to load discovered leads');
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = leads.filter((lead) => {
    // Search filter
    const matchesSearch = !searchTerm || 
      (lead.full_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.company?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.title?.toLowerCase().includes(searchTerm.toLowerCase()));

    // Category filter
    let matchesFilter = true;
    switch (filterBy) {
      case 'high_intent':
        matchesFilter = lead.intent_score >= 0.7;
        break;
      case 'has_email':
        matchesFilter = !!lead.email;
        break;
      case 'has_phone':
        matchesFilter = !!lead.phone;
        break;
      default:
        matchesFilter = true;
    }

    return matchesSearch && matchesFilter;
  });

  const handleSelectLead = (leadId: string) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const handleSelectAll = () => {
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredLeads.map(lead => lead.id));
    }
  };

  const exportLeads = () => {
    const leadsToExport = selectedLeads.length > 0 
      ? leads.filter(lead => selectedLeads.includes(lead.id))
      : filteredLeads;

    const csvContent = [
      ['Name', 'Email', 'Phone', 'Company', 'Title', 'LinkedIn', 'Location', 'Intent Score', 'Tags', 'Reasons', 'Source'],
      ...leadsToExport.map(lead => [
        lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || '',
        lead.email || '',
        lead.phone || '',
        lead.company || '',
        lead.title || '',
        lead.linkedin_url || '',
        [lead.city, lead.state, lead.country].filter(Boolean).join(', '),
        lead.intent_score?.toString() || '0',
        lead.tags?.join('; ') || '',
        lead.reasons?.join('; ') || '',
        lead.source_slug || ''
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `discovered_leads_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getIntentScoreColor = (score: number) => {
    if (score >= 0.8) return theme === 'gold' ? 'text-green-400' : 'text-green-600';
    if (score >= 0.6) return theme === 'gold' ? 'text-yellow-400' : 'text-yellow-600';
    if (score >= 0.4) return theme === 'gold' ? 'text-orange-400' : 'text-orange-600';
    return theme === 'gold' ? 'text-red-400' : 'text-red-600';
  };

  const getIntentScoreBg = (score: number) => {
    if (score >= 0.8) return theme === 'gold' ? 'bg-green-500/20' : 'bg-green-100';
    if (score >= 0.6) return theme === 'gold' ? 'bg-yellow-500/20' : 'bg-yellow-100';
    if (score >= 0.4) return theme === 'gold' ? 'bg-orange-500/20' : 'bg-orange-100';
    return theme === 'gold' ? 'bg-red-500/20' : 'bg-red-100';
  };

  const selectedRunData = intentRuns.find(run => run.id === selectedRun);

  if (loading && leads.length === 0) {
    return <LoadingSpinner size="lg" message="Loading discovered leads..." className="h-64" />;
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
              <Target className="h-8 w-8 text-blue-600" />
            )}
            <h2 className={`text-2xl font-bold ${
              theme === 'gold' ? 'gold-text-gradient' : 'text-gray-900'
            }`}>
              Discovered Leads
            </h2>
          </div>
          <p className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
            High-intent prospects found by AI discovery
          </p>
        </div>
        
        {selectedLeads.length > 0 && onAddToList && (
          <button
            onClick={() => onAddToList(leads.filter(lead => selectedLeads.includes(lead.id)))}
            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              theme === 'gold'
                ? 'gold-gradient text-black hover-gold'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add {selectedLeads.length} to List
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <ErrorMessage
          message={error}
          onDismiss={() => setError('')}
        />
      )}

      {/* Run Selection */}
      <div className={`p-4 rounded-lg border ${
        theme === 'gold'
          ? 'border-yellow-400/20 bg-black/10'
          : 'border-gray-200 bg-gray-50'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Discovery Run
            </label>
            <select
              value={selectedRun}
              onChange={(e) => setSelectedRun(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                theme === 'gold'
                  ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                  : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
              }`}
            >
              <option value="">Select a discovery run...</option>
              {intentRuns.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.goal.substring(0, 60)}... ({run.leads_found} leads, ${run.cost_usd.toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          {selectedRunData && (
            <div className={`p-3 rounded-lg ${
              theme === 'gold' ? 'bg-yellow-400/10' : 'bg-blue-50'
            }`}>
              <div className={`text-sm font-medium ${
                theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
              }`}>
                Run Summary
              </div>
              <div className={`text-xs ${
                theme === 'gold' ? 'text-yellow-300' : 'text-blue-600'
              }`}>
                {selectedRunData.leads_found} leads • ${selectedRunData.cost_usd.toFixed(2)} cost • {selectedRunData.niche}
              </div>
              <div className={`text-xs ${
                theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
              }`}>
                {new Date(selectedRunData.created_at).toLocaleDateString()}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedRun && (
        <>
          {/* Filters and Search */}
          <div className={`p-4 rounded-lg border ${
            theme === 'gold'
              ? 'border-yellow-400/20 bg-black/10'
              : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Search */}
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                    theme === 'gold' ? 'text-yellow-400' : 'text-gray-400'
                  }`} />
                  <input
                    type="text"
                    placeholder="Search discovered leads..."
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

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={filterBy}
                  onChange={(e) => setFilterBy(e.target.value as any)}
                  className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    theme === 'gold'
                      ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                      : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                  }`}
                >
                  <option value="all">All Leads</option>
                  <option value="high_intent">High Intent (70%+)</option>
                  <option value="has_email">Has Email</option>
                  <option value="has_phone">Has Phone</option>
                </select>

                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortBy(field as any);
                    setSortOrder(order as any);
                  }}
                  className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    theme === 'gold'
                      ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                      : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                  }`}
                >
                  <option value="intent_score-desc">Highest Intent</option>
                  <option value="intent_score-asc">Lowest Intent</option>
                  <option value="created_at-desc">Newest First</option>
                  <option value="created_at-asc">Oldest First</option>
                  <option value="company-asc">Company A-Z</option>
                  <option value="company-desc">Company Z-A</option>
                </select>

                {selectedLeads.length > 0 && (
                  <button
                    onClick={exportLeads}
                    className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                      theme === 'gold'
                        ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Export ({selectedLeads.length})
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`p-4 rounded-lg border ${
              theme === 'gold'
                ? 'border-yellow-400/20 bg-black/20'
                : 'border-gray-200 bg-white'
            }`}>
              <div className="flex items-center">
                <Users className={`h-5 w-5 mr-2 ${
                  theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                }`} />
                <span className={`text-sm font-medium ${
                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Total Leads
                </span>
              </div>
              <p className={`text-2xl font-bold mt-1 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
              }`}>
                {filteredLeads.length}
              </p>
            </div>

            <div className={`p-4 rounded-lg border ${
              theme === 'gold'
                ? 'border-yellow-400/20 bg-black/20'
                : 'border-gray-200 bg-white'
            }`}>
              <div className="flex items-center">
                <Star className={`h-5 w-5 mr-2 ${
                  theme === 'gold' ? 'text-yellow-400' : 'text-green-600'
                }`} />
                <span className={`text-sm font-medium ${
                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  High Intent
                </span>
              </div>
              <p className={`text-2xl font-bold mt-1 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-green-600'
              }`}>
                {filteredLeads.filter(l => l.intent_score >= 0.7).length}
              </p>
            </div>

            <div className={`p-4 rounded-lg border ${
              theme === 'gold'
                ? 'border-yellow-400/20 bg-black/20'
                : 'border-gray-200 bg-white'
            }`}>
              <div className="flex items-center">
                <Mail className={`h-5 w-5 mr-2 ${
                  theme === 'gold' ? 'text-yellow-400' : 'text-purple-600'
                }`} />
                <span className={`text-sm font-medium ${
                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  With Email
                </span>
              </div>
              <p className={`text-2xl font-bold mt-1 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-purple-600'
              }`}>
                {filteredLeads.filter(l => l.email).length}
              </p>
            </div>

            <div className={`p-4 rounded-lg border ${
              theme === 'gold'
                ? 'border-yellow-400/20 bg-black/20'
                : 'border-gray-200 bg-white'
            }`}>
              <div className="flex items-center">
                <Phone className={`h-5 w-5 mr-2 ${
                  theme === 'gold' ? 'text-yellow-400' : 'text-orange-600'
                }`} />
                <span className={`text-sm font-medium ${
                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  With Phone
                </span>
              </div>
              <p className={`text-2xl font-bold mt-1 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-orange-600'
              }`}>
                {filteredLeads.filter(l => l.phone).length}
              </p>
            </div>
          </div>

          {/* Leads Table */}
          <div className={`rounded-xl border ${
            theme === 'gold' 
              ? 'black-card gold-border' 
              : 'bg-white border-gray-200'
          }`}>
            {filteredLeads.length === 0 ? (
              <div className="text-center py-12">
                <Target className={`h-12 w-12 mx-auto mb-4 ${
                  theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
                }`} />
                <h3 className={`text-lg font-medium mb-2 ${
                  theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                }`}>
                  {selectedRun ? 'No leads found' : 'Select a discovery run'}
                </h3>
                <p className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
                  {selectedRun 
                    ? searchTerm || filterBy !== 'all'
                      ? 'No leads match your search criteria'
                      : 'This discovery run found no leads'
                    : 'Choose a discovery run from the dropdown above to view leads'
                  }
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className={`${
                      theme === 'gold' ? 'bg-black/20' : 'bg-gray-50'
                    }`}>
                      <tr>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          <input
                            type="checkbox"
                            checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                            onChange={handleSelectAll}
                            className="rounded"
                          />
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Lead
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Contact
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Company
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Intent Score
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Source
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${
                      theme === 'gold' ? 'divide-yellow-400/20' : 'divide-gray-200'
                    }`}>
                      {filteredLeads.map((lead) => (
                        <tr key={lead.id} className={`hover:${
                          theme === 'gold' ? 'bg-yellow-400/5' : 'bg-gray-50'
                        } transition-colors`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedLeads.includes(lead.id)}
                              onChange={() => handleSelectLead(lead.id)}
                              className="rounded"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                theme === 'gold' ? 'bg-blue-500/20' : 'bg-blue-100'
                              }`}>
                                <Users className={`h-5 w-5 ${
                                  theme === 'gold' ? 'text-blue-400' : 'text-blue-600'
                                }`} />
                              </div>
                              <div className="ml-4">
                                <div className={`text-sm font-medium ${
                                  theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                                }`}>
                                  {lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown'}
                                </div>
                                {lead.title && (
                                  <div className={`text-sm ${
                                    theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                                  }`}>
                                    {lead.title}
                                  </div>
                                )}
                                {lead.linkedin_url && (
                                  <a
                                    href={lead.linkedin_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`text-xs hover:underline flex items-center ${
                                      theme === 'gold' ? 'text-blue-400' : 'text-blue-600'
                                    }`}
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    LinkedIn
                                  </a>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="space-y-1">
                              {lead.email && (
                                <div className={`flex items-center text-sm ${
                                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                  <Mail className="h-3 w-3 mr-2" />
                                  {lead.email}
                                </div>
                              )}
                              {lead.phone && (
                                <div className={`flex items-center text-sm ${
                                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                  <Phone className="h-3 w-3 mr-2" />
                                  {lead.phone}
                                </div>
                              )}
                              {!lead.email && !lead.phone && (
                                <span className={`text-sm ${
                                  theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                                }`}>
                                  No contact info
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              {lead.company ? (
                                <div className={`flex items-center text-sm ${
                                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                  <Building className="h-3 w-3 mr-2" />
                                  {lead.company}
                                </div>
                              ) : (
                                <span className={`text-sm ${
                                  theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                                }`}>
                                  No company
                                </span>
                              )}
                              {(lead.city || lead.state || lead.country) && (
                                <div className={`flex items-center text-xs mt-1 ${
                                  theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                                }`}>
                                  <MapPin className="h-3 w-3 mr-1" />
                                  {[lead.city, lead.state, lead.country].filter(Boolean).join(', ')}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                                getIntentScoreBg(lead.intent_score)
                              }`}>
                                <span className={getIntentScoreColor(lead.intent_score)}>
                                  {Math.round(lead.intent_score * 100)}%
                                </span>
                              </div>
                              {lead.intent_score >= 0.8 && (
                                <Star className={`h-4 w-4 ${
                                  theme === 'gold' ? 'text-yellow-400' : 'text-yellow-500'
                                }`} />
                              )}
                            </div>
                            {lead.tags && lead.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {lead.tags.slice(0, 2).map((tag, index) => (
                                  <span
                                    key={index}
                                    className={`text-xs px-2 py-1 rounded-full ${
                                      theme === 'gold'
                                        ? 'bg-blue-500/20 text-blue-400'
                                        : 'bg-blue-100 text-blue-700'
                                    }`}
                                  >
                                    {tag}
                                  </span>
                                ))}
                                {lead.tags.length > 2 && (
                                  <span className={`text-xs px-2 py-1 rounded-full ${
                                    theme === 'gold'
                                      ? 'bg-gray-500/20 text-gray-400'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    +{lead.tags.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm ${
                              theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                              {lead.source_slug || 'Unknown'}
                            </div>
                            <div className={`text-xs ${
                              theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                            }`}>
                              {new Date(lead.created_at).toLocaleDateString()}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Bulk Actions */}
                {selectedLeads.length > 0 && (
                  <div className={`px-6 py-4 border-t ${
                    theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
                  }`}>
                    <div className={`p-4 rounded-lg ${
                      theme === 'gold'
                        ? 'bg-yellow-400/10 border border-yellow-400/20'
                        : 'bg-blue-50 border border-blue-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${
                          theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
                        }`}>
                          {selectedLeads.length} leads selected
                        </span>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setSelectedLeads([])}
                            className={`text-sm ${
                              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                            } hover:underline`}
                          >
                            Clear selection
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
    </div>
  );
}