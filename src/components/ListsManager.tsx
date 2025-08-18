import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { LoadingSpinner } from './common/LoadingSpinner';
import { ErrorMessage } from './common/ErrorMessage';
import { LeadEditModal } from './LeadEditModal';
import { IntentDiscoveryChat } from './IntentDiscoveryChat';
import { ExportToCampaignModal } from './ExportToCampaignModal';
import { LeadUploadModal } from './LeadUploadModal';
import { EnrichmentModal } from './EnrichmentModal';
import { 
  Plus, 
  Users, 
  Search, 
  Edit2, 
  Trash2, 
  Eye,
  Download,
  Upload,
  Target,
  MessageSquare,
  Crown,
  Zap,
  CheckCircle,
  Building,
  Mail,
  Phone,
  Briefcase,
  ExternalLink,
  Send,
  Filter,
  BarChart3,
  Sparkles
} from 'lucide-react';

interface List {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  created_at: string;
  lead_count?: number;
}

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  job_title: string | null;
  source_url: string | null;
  source_platform: string | null;
  custom_fields: Record<string, any>;
  intent_score: number;
  source_slug: string | null;
  created_at: string;
}

interface DiscoveredLead {
  id: string;
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

export function ListsManager() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [lists, setLists] = useState<List[]>([]);
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [discoveredLeads, setDiscoveredLeads] = useState<DiscoveredLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [showCreateList, setShowCreateList] = useState(false);
  const [showEditLead, setShowEditLead] = useState<Lead | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEnrichmentModal, setShowEnrichmentModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'lists' | 'discovery' | 'discovered'>('discovery');
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user) {
      fetchLists();
      if (activeTab === 'discovered') {
        fetchDiscoveredLeads();
      }
    }
  }, [user, activeTab]);

  useEffect(() => {
    if (selectedList) {
      fetchListLeads(selectedList);
    }
  }, [selectedList]);

  const fetchLists = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('lists')
        .select(`
          *,
          list_leads(count)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const listsWithCounts = data?.map(list => ({
        ...list,
        lead_count: list.list_leads?.[0]?.count || 0
      })) || [];

      setLists(listsWithCounts);
      
      if (listsWithCounts.length > 0 && !selectedList) {
        setSelectedList(listsWithCounts[0].id);
      }
    } catch (error) {
      console.error('Error fetching lists:', error);
      setError('Failed to load lists');
    } finally {
      setLoading(false);
    }
  };

  const fetchListLeads = async (listId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('list_leads')
        .select('*')
        .eq('list_id', listId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching list leads:', error);
      setError('Failed to load leads');
    }
  };

  const fetchDiscoveredLeads = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('discovered_leads')
        .select('*')
        .eq('user_id', user.id)
        .order('intent_score', { ascending: false })
        .limit(100);

      if (error) {
        // Handle missing table gracefully
        if (error.code === '42P01') {
          console.warn('Discovered leads table not yet created');
          setDiscoveredLeads([]);
          return;
        }
        throw error;
      }
      setDiscoveredLeads(data || []);
    } catch (error) {
      console.error('Error fetching discovered leads:', error);
      setDiscoveredLeads([]);
      setError('Failed to load discovered leads');
    }
  };

  const createList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newListName.trim()) return;

    setCreating(true);
    try {
      const { error } = await supabase
        .from('lists')
        .insert([{
          user_id: user.id,
          name: newListName.trim(),
          description: newListDescription.trim() || null,
          tags: []
        }]);

      if (error) throw error;

      setNewListName('');
      setNewListDescription('');
      setShowCreateList(false);
      fetchLists();
    } catch (error) {
      console.error('Error creating list:', error);
      setError('Failed to create list');
    } finally {
      setCreating(false);
    }
  };

  const deleteList = async (listId: string) => {
    if (!confirm('Are you sure you want to delete this list and all its leads?')) return;

    try {
      const { error } = await supabase
        .from('lists')
        .delete()
        .eq('id', listId)
        .eq('user_id', user?.id);

      if (error) throw error;

      if (selectedList === listId) {
        setSelectedList(null);
        setLeads([]);
      }
      fetchLists();
    } catch (error) {
      console.error('Error deleting list:', error);
      setError('Failed to delete list');
    }
  };

  const addDiscoveredLeadToList = async (discoveredLead: DiscoveredLead, listId: string) => {
    if (!user) return;

    try {
      // Check if lead with same email already exists in this list
      if (discoveredLead.email) {
        const { data: existingLead, error: checkError } = await supabase
          .from('list_leads')
          .select('id')
          .eq('list_id', listId)
          .eq('email', discoveredLead.email)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }

        if (existingLead) {
          setError('Lead with this email already exists in the list');
          return;
        }
      }

      // Transform discovered lead to list lead format
      const listLead = {
        list_id: listId,
        user_id: user.id,
        name: discoveredLead.full_name || `${discoveredLead.first_name || ''} ${discoveredLead.last_name || ''}`.trim(),
        email: discoveredLead.email,
        phone: discoveredLead.phone,
        company_name: discoveredLead.company,
        job_title: discoveredLead.title,
        source_url: discoveredLead.linkedin_url,
        source_platform: discoveredLead.source_slug,
        intent_score: discoveredLead.intent_score,
        source_slug: discoveredLead.source_slug,
        master_lead_id: discoveredLead.id,
        custom_fields: {
          company_domain: discoveredLead.company_domain,
          country: discoveredLead.country,
          state: discoveredLead.state,
          city: discoveredLead.city,
          tags: discoveredLead.tags,
          reasons: discoveredLead.reasons,
          raw_data: discoveredLead.raw
        }
      };

      const { error } = await supabase
        .from('list_leads')
        .insert([listLead]);

      if (error) throw error;

      // Refresh the current list if it's selected
      if (selectedList === listId) {
        fetchListLeads(listId);
      }
      fetchLists(); // Update counts
    } catch (error) {
      console.error('Error adding lead to list:', error);
      setError('Failed to add lead to list');
    }
  };

  const deleteSelectedLeads = async () => {
    if (!user || !selectedList || selectedLeads.length === 0) return;

    try {
      const { error } = await supabase
        .from('list_leads')
        .delete()
        .in('id', selectedLeads)
        .eq('user_id', user.id);

      if (error) throw error;

      setSelectedLeads([]);
      fetchListLeads(selectedList);
      fetchLists(); // Update counts
    } catch (error) {
      console.error('Error deleting selected leads:', error);
      setError('Failed to delete selected leads');
    }
  };

  const deleteSingleLead = async (leadId: string) => {
    if (!user || !selectedList) return;

    try {
      const { error } = await supabase
        .from('list_leads')
        .delete()
        .eq('id', leadId)
        .eq('user_id', user.id);

      if (error) throw error;

      fetchListLeads(selectedList);
      fetchLists(); // Update counts
    } catch (error) {
      console.error('Error deleting lead:', error);
      setError('Failed to delete lead');
    }
  };

  const handleSelectLead = (leadId: string) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const handleSelectAll = () => {
    if (selectedLeads.length === leads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(leads.map(lead => lead.id));
    }
  };

  const exportLeads = () => {
    const leadsToExport = selectedLeads.length > 0 
      ? leads.filter(lead => selectedLeads.includes(lead.id))
      : leads;

    const csvContent = [
      ['Name', 'Email', 'Phone', 'Company', 'Job Title', 'Source', 'Intent Score', 'Created'],
      ...leadsToExport.map(lead => [
        lead.name || '',
        lead.email || '',
        lead.phone || '',
        lead.company_name || '',
        lead.job_title || '',
        lead.source_platform || '',
        lead.intent_score?.toString() || '0',
        new Date(lead.created_at).toLocaleDateString()
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLeads = leads.filter(lead =>
    !searchTerm || 
    lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.job_title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDiscoveredLeads = discoveredLeads.filter(lead =>
    !searchTerm ||
    lead.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <LoadingSpinner size="lg" message="Loading lists..." className="h-64" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-3 mb-2">
          {theme === 'gold' ? (
            <Crown className="h-8 w-8 text-yellow-400" />
          ) : (
            <Users className="h-8 w-8 text-blue-600" />
          )}
          <h1 className={`text-3xl font-bold ${
            theme === 'gold' ? 'gold-text-gradient' : 'text-gray-900'
          }`}>
            Lead Discovery & Lists
          </h1>
        </div>
        <p className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
          Discover high-intent leads and organize them into targeted lists
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <ErrorMessage
          message={error}
          onDismiss={() => setError('')}
        />
      )}

      {/* Tabs */}
      <div className={`rounded-xl shadow-sm border ${
        theme === 'gold' 
          ? 'black-card gold-border' 
          : 'bg-white border-gray-200'
      }`}>
        <div className={`border-b ${
          theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
        }`}>
          <nav className="flex overflow-x-auto px-4 sm:px-6">
            {[
              { key: 'discovery', label: 'Intent Discovery', icon: Sparkles },
              { key: 'discovered', label: 'Discovered Leads', icon: Target },
              { key: 'lists', label: 'My Lists', icon: Users }
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

        <div className="p-4 sm:p-6">
          {/* Intent Discovery Tab */}
          {activeTab === 'discovery' && (
            <IntentDiscoveryChat onLeadsFound={fetchDiscoveredLeads} />
          )}

          {/* Discovered Leads Tab */}
          {activeTab === 'discovered' && (
            <div className="space-y-6">
              {/* Search */}
              <div className="flex items-center space-x-4">
                <div className="flex-1">
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
              </div>

              {/* Discovered Leads Grid */}
              {filteredDiscoveredLeads.length === 0 ? (
                <div className="text-center py-12">
                  <Target className={`h-12 w-12 mx-auto mb-4 ${
                    theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
                  }`} />
                  <h3 className={`text-lg font-medium mb-2 ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    No discovered leads yet
                  </h3>
                  <p className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
                    Use the Intent Discovery tab to find high-intent leads
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDiscoveredLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className={`p-4 rounded-lg border transition-all hover:shadow-md ${
                        theme === 'gold'
                          ? 'border-yellow-400/20 bg-black/10 hover:bg-yellow-400/5'
                          : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      {/* Intent Score Badge */}
                      <div className="flex items-center justify-between mb-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          lead.intent_score >= 0.8
                            ? theme === 'gold' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-800'
                            : lead.intent_score >= 0.6
                            ? theme === 'gold' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-800'
                            : theme === 'gold' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {Math.round(lead.intent_score * 100)}% Intent
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          theme === 'gold' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {lead.source_slug}
                        </span>
                      </div>

                      {/* Lead Info */}
                      <div className="space-y-2">
                        <h4 className={`font-semibold ${
                          theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                        }`}>
                          {lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unknown'}
                        </h4>
                        
                        {lead.title && (
                          <div className={`flex items-center text-sm ${
                            theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            <Briefcase className="h-3 w-3 mr-2" />
                            {lead.title}
                          </div>
                        )}
                        
                        {lead.company && (
                          <div className={`flex items-center text-sm ${
                            theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            <Building className="h-3 w-3 mr-2" />
                            {lead.company}
                          </div>
                        )}
                        
                        {lead.email && (
                          <div className={`flex items-center text-sm ${
                            theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            <Mail className="h-3 w-3 mr-2" />
                            {lead.email}
                          </div>
                        )}
                        
                        {lead.linkedin_url && (
                          <a
                            href={lead.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center text-sm hover:underline ${
                              theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                            }`}
                          >
                            <ExternalLink className="h-3 w-3 mr-2" />
                            LinkedIn Profile
                          </a>
                        )}
                      </div>

                      {/* Intent Reasons */}
                      {lead.reasons && lead.reasons.length > 0 && (
                        <div className="mt-3">
                          <div className={`text-xs font-medium mb-1 ${
                            theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            Why this lead:
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {lead.reasons.slice(0, 2).map((reason, index) => (
                              <span
                                key={index}
                                className={`text-xs px-2 py-1 rounded-full ${
                                  theme === 'gold'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Add to List Dropdown */}
                      <div className="mt-4">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              addDiscoveredLeadToList(lead, e.target.value);
                              e.target.value = '';
                            }
                          }}
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                            theme === 'gold'
                              ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                              : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                          }`}
                        >
                          <option value="">Add to list...</option>
                          {lists.map((list) => (
                            <option key={list.id} value={list.id}>
                              {list.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Lists Tab */}
          {activeTab === 'lists' && (
            <div className="space-y-6">
              {/* Lists Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-lg font-semibold ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    Your Lists ({lists.length})
                  </h3>
                  <p className={`text-sm ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Organize leads into targeted lists for campaigns
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateList(true)}
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    theme === 'gold'
                      ? 'gold-gradient text-black hover-gold'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New List
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Lists Sidebar */}
                <div className="space-y-4">
                  {lists.length === 0 ? (
                    <div className={`text-center py-8 border-2 border-dashed rounded-lg ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 text-gray-400'
                        : 'border-gray-300 text-gray-500'
                    }`}>
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No lists yet</p>
                      <button
                        onClick={() => setShowCreateList(true)}
                        className={`mt-2 text-sm ${
                          theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                        } hover:underline`}
                      >
                        Create your first list
                      </button>
                    </div>
                  ) : (
                    lists.map((list) => (
                      <div
                        key={list.id}
                        onClick={() => setSelectedList(list.id)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          selectedList === list.id
                            ? theme === 'gold'
                              ? 'border-yellow-400 bg-yellow-400/10'
                              : 'border-blue-500 bg-blue-50'
                            : theme === 'gold'
                              ? 'border-yellow-400/20 bg-black/10 hover:bg-yellow-400/5'
                              : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className={`font-semibold ${
                            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                          }`}>
                            {list.name}
                          </h4>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteList(list.id);
                            }}
                            className={`p-1 rounded transition-colors ${
                              theme === 'gold'
                                ? 'text-red-400 hover:bg-red-400/10'
                                : 'text-red-600 hover:bg-red-50'
                            }`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <p className={`text-sm ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {list.description || 'No description'}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className={`text-xs ${
                            theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                          }`}>
                            {list.lead_count || 0} leads
                          </span>
                          <span className={`text-xs ${
                            theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                          }`}>
                            {new Date(list.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Leads Content */}
                <div className="lg:col-span-2 space-y-4">
                  {selectedList ? (
                    <>
                      {/* List Header with Actions */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className={`text-lg font-semibold ${
                            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                          }`}>
                            {lists.find(l => l.id === selectedList)?.name || 'Selected List'}
                          </h4>
                          <p className={`text-sm ${
                            theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            {leads.length} leads in this list
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setShowUploadModal(true)}
                            className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                              theme === 'gold'
                                ? 'border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Leads
                          </button>
                          <button
                            onClick={() => setShowEnrichmentModal(true)}
                            disabled={leads.length === 0}
                            className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                              theme === 'gold'
                                ? 'gold-gradient text-black hover-gold'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            } disabled:opacity-50`}
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            Enrich List
                          </button>
                        </div>
                      </div>

                      {/* List Actions */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="relative">
                            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                              theme === 'gold' ? 'text-yellow-400' : 'text-gray-400'
                            }`} />
                            <input
                              type="text"
                              placeholder="Search leads..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className={`pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                                theme === 'gold'
                                  ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                                  : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                              } focus:border-transparent`}
                            />
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {selectedLeads.length > 0 && (
                            <>
                              <button
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete ${selectedLeads.length} selected leads?`)) {
                                    deleteSelectedLeads();
                                  }
                                }}
                                className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                                  theme === 'gold'
                                    ? 'bg-red-600 text-white hover:bg-red-700'
                                    : 'bg-red-600 text-white hover:bg-red-700'
                                }`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete ({selectedLeads.length})
                              </button>
                              <button
                                onClick={() => setShowExportModal(true)}
                                className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                                  theme === 'gold'
                                    ? 'gold-gradient text-black hover-gold'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Send to Campaign ({selectedLeads.length})
                              </button>
                              <button
                                onClick={exportLeads}
                                className={`inline-flex items-center px-3 py-2 text-sm rounded-lg border transition-colors ${
                                  theme === 'gold'
                                    ? 'border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Export
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Leads Table */}
                      {filteredLeads.length === 0 ? (
                        <div className="text-center py-12">
                          <Users className={`h-12 w-12 mx-auto mb-4 ${
                            theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
                          }`} />
                          <h3 className={`text-lg font-medium mb-2 ${
                            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                          }`}>
                            No leads in this list
                          </h3>
                          <p className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
                            Add leads from the Discovered Leads tab
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Select All */}
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                              onChange={handleSelectAll}
                              className="rounded"
                            />
                            <span className={`text-sm ${
                              theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                              Select all ({filteredLeads.length})
                            </span>
                          </div>

                          {/* Leads List */}
                          {filteredLeads.map((lead) => (
                            <div
                              key={lead.id}
                              className={`p-4 rounded-lg border transition-colors ${
                                selectedLeads.includes(lead.id)
                                  ? theme === 'gold'
                                    ? 'border-yellow-400 bg-yellow-400/10'
                                    : 'border-blue-500 bg-blue-50'
                                  : theme === 'gold'
                                    ? 'border-yellow-400/20 bg-black/10 hover:bg-yellow-400/5'
                                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                              }`}
                            >
                              <div className="flex items-start space-x-3">
                                <input
                                  type="checkbox"
                                  checked={selectedLeads.includes(lead.id)}
                                  onChange={() => handleSelectLead(lead.id)}
                                  className="mt-1 rounded"
                                />
                                
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className={`font-semibold ${
                                      theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                                    }`}>
                                      {lead.name}
                                    </h4>
                                    {lead.intent_score > 0 && (
                                      <span className={`text-xs px-2 py-1 rounded-full ${
                                        lead.intent_score >= 0.8
                                          ? theme === 'gold' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-800'
                                          : theme === 'gold' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-800'
                                      }`}>
                                        {Math.round(lead.intent_score * 100)}% Intent
                                      </span>
                                    )}
                                  </div>
                                  
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
                                    {lead.company_name && (
                                      <div className={`flex items-center text-sm ${
                                        theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                                      }`}>
                                        <Building className="h-3 w-3 mr-2" />
                                        {lead.company_name}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <button
                                  onClick={() => setShowEditLead(lead)}
                                  className={`p-2 rounded-lg transition-colors ${
                                    theme === 'gold'
                                      ? 'text-yellow-400 hover:bg-yellow-400/10'
                                      : 'text-blue-600 hover:bg-blue-100'
                                  }`}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm('Are you sure you want to delete this lead?')) {
                                      deleteSingleLead(lead.id);
                                    }
                                  }}
                                  className={`p-2 rounded-lg transition-colors ${
                                    theme === 'gold'
                                      ? 'text-red-400 hover:bg-red-400/10'
                                      : 'text-red-600 hover:bg-red-50'
                                  }`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <Users className={`h-12 w-12 mx-auto mb-4 ${
                        theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
                      }`} />
                      <h3 className={`text-lg font-medium mb-2 ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        Select a list to view leads
                      </h3>
                      <p className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
                        Choose a list from the sidebar to manage its leads
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create List Modal */}
      {showCreateList && (
        <div className={`fixed inset-0 z-50 overflow-y-auto ${
          theme === 'gold' ? 'bg-black/75' : 'bg-gray-900/50'
        }`}>
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className={`w-full max-w-md rounded-xl shadow-2xl ${
              theme === 'gold' ? 'black-card gold-border' : 'bg-white border border-gray-200'
            }`}>
              <div className={`p-6 border-b ${
                theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
              }`}>
                <h3 className={`text-lg font-semibold ${
                  theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                }`}>
                  Create New List
                </h3>
              </div>

              <form onSubmit={createList} className="p-6 space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    List Name *
                  </label>
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                    }`}
                    placeholder="e.g., SaaS Founders Q4"
                    required
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Description
                  </label>
                  <textarea
                    value={newListDescription}
                    onChange={(e) => setNewListDescription(e.target.value)}
                    rows={3}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                    }`}
                    placeholder="Describe this list..."
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateList(false)}
                    className={`flex-1 px-4 py-2 text-sm rounded-lg transition-colors ${
                      theme === 'gold'
                        ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                        : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      theme === 'gold'
                        ? 'gold-gradient text-black hover-gold'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    } disabled:opacity-50`}
                  >
                    {creating ? 'Creating...' : 'Create List'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Lead Edit Modal */}
      {showEditLead && (
        <LeadEditModal
          lead={showEditLead}
          listId={selectedList!}
          onClose={() => setShowEditLead(null)}
          onSave={() => {
            setShowEditLead(null);
            if (selectedList) fetchListLeads(selectedList);
          }}
        />
      )}

      {/* Export to Campaign Modal */}
      {showExportModal && selectedList && (
        <ExportToCampaignModal
          listId={selectedList}
          selectedLeadIds={selectedLeads}
          onClose={() => setShowExportModal(false)}
          onSuccess={() => {
            setShowExportModal(false);
            setSelectedLeads([]);
          }}
        />
      )}

      {/* Lead Upload Modal */}
      {showUploadModal && selectedList && (
        <LeadUploadModal
          listId={selectedList}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            if (selectedList) fetchListLeads(selectedList);
            fetchLists(); // Update counts
          }}
        />
      )}

      {/* Enrichment Modal */}
      {showEnrichmentModal && selectedList && (
        <EnrichmentModal
          listId={selectedList}
          leadCount={leads.length}
          onClose={() => setShowEnrichmentModal(false)}
          onSuccess={() => {
            setShowEnrichmentModal(false);
            if (selectedList) fetchListLeads(selectedList);
          }}
        />
      )}
    </div>
  );
}