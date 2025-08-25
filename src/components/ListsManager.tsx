import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { LoadingSpinner } from './common/LoadingSpinner';
import { ErrorMessage } from './common/ErrorMessage';
import { LeadUploadModal } from './LeadUploadModal';
import { LeadEditModal } from './LeadEditModal';
import { EnrichmentModal } from './EnrichmentModal';
import { ListCleaningModal } from './ListCleaningModal';
import { ExportToCampaignModal } from './ExportToCampaignModal';
import { IntentDiscoveryChat } from './IntentDiscoveryChat';
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Edit2, 
  Trash2, 
  Download, 
  Upload, 
  Sparkles, 
  Target, 
  Send, 
  MessageSquare, 
  Crown, 
  Zap, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Building, 
  Mail, 
  Phone, 
  Briefcase,
  Shield
} from 'lucide-react';

interface List {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  lead_count?: number;
}

interface ListLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  job_title: string | null;
  source_url: string | null;
  source_platform: string | null;
  custom_fields: Record<string, any>;
  created_at: string;
}

export function ListsManager() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [lists, setLists] = useState<List[]>([]);
  const [selectedList, setSelectedList] = useState<List | null>(null);
  const [listLeads, setListLeads] = useState<ListLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEnrichmentModal, setShowEnrichmentModal] = useState(false);
  const [showCleaningModal, setShowCleaningModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showIntentDiscovery, setShowIntentDiscovery] = useState(false);
  const [editingLead, setEditingLead] = useState<ListLead | null>(null);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user) {
      fetchLists();
    }
  }, [user]);

  useEffect(() => {
    if (selectedList) {
      fetchListLeads();
    }
  }, [selectedList]);

  const fetchLists = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Fetch lists with lead counts
      const { data: listsData, error: listsError } = await supabase
        .from('lists')
        .select(`
          *,
          list_leads(count)
        `)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (listsError) throw listsError;

      const listsWithCounts = listsData?.map(list => ({
        ...list,
        lead_count: list.list_leads?.[0]?.count || 0
      })) || [];

      setLists(listsWithCounts);
      
      // Auto-select first list if none selected
      if (!selectedList && listsWithCounts.length > 0) {
        setSelectedList(listsWithCounts[0]);
      }
    } catch (error) {
      console.error('Error fetching lists:', error);
      setError('Failed to load lists');
    } finally {
      setLoading(false);
    }
  };

  const fetchListLeads = async () => {
    if (!selectedList || !user) return;

    try {
      setLeadsLoading(true);
      
      const { data, error } = await supabase
        .from('list_leads')
        .select('*')
        .eq('list_id', selectedList.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setListLeads(data || []);
    } catch (error) {
      console.error('Error fetching list leads:', error);
      setError('Failed to load list leads');
    } finally {
      setLeadsLoading(false);
    }
  };

  const createList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newListName.trim()) return;

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('lists')
        .insert([{
          user_id: user.id,
          name: newListName.trim(),
          description: newListDescription.trim() || null,
          tags: []
        }])
        .select()
        .single();

      if (error) throw error;

      setNewListName('');
      setNewListDescription('');
      setShowCreateForm(false);
      fetchLists();
      setSelectedList(data);
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

      if (selectedList?.id === listId) {
        setSelectedList(null);
        setListLeads([]);
      }
      fetchLists();
    } catch (error) {
      console.error('Error deleting list:', error);
      setError('Failed to delete list');
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
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredLeads.map(lead => lead.id));
    }
  };

  const exportLeads = () => {
    const leadsToExport = selectedLeads.length > 0 
      ? listLeads.filter(lead => selectedLeads.includes(lead.id))
      : filteredLeads;

    const csvContent = [
      ['Name', 'Email', 'Phone', 'Company', 'Job Title', 'Source URL', 'Source Platform', 'Created'],
      ...leadsToExport.map(lead => [
        lead.name || '',
        lead.email || '',
        lead.phone || '',
        lead.company_name || '',
        lead.job_title || '',
        lead.source_url || '',
        lead.source_platform || '',
        new Date(lead.created_at).toLocaleDateString()
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedList?.name || 'leads'}_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteSelectedLeads = async () => {
    if (selectedLeads.length === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedLeads.length} selected leads?`)) return;

    try {
      const { error } = await supabase
        .from('list_leads')
        .delete()
        .in('id', selectedLeads)
        .eq('user_id', user?.id);

      if (error) throw error;

      setSelectedLeads([]);
      fetchListLeads();
      fetchLists(); // Refresh counts
    } catch (error) {
      console.error('Error deleting leads:', error);
      setError('Failed to delete leads');
    }
  };

  const filteredLeads = listLeads.filter((lead) => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      (lead.name?.toLowerCase().includes(searchLower)) ||
      (lead.email?.toLowerCase().includes(searchLower)) ||
      (lead.phone?.includes(searchTerm)) ||
      (lead.company_name?.toLowerCase().includes(searchLower)) ||
      (lead.job_title?.toLowerCase().includes(searchLower))
    );
  });

  if (loading) {
    return <LoadingSpinner size="lg" message="Loading lists..." className="h-64" />;
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
              <Users className="h-8 w-8 text-blue-600" />
            )}
            <h1 className={`text-3xl font-bold ${
              theme === 'gold' ? 'gold-text-gradient' : 'text-gray-900'
            }`}>
              Lists Manager
            </h1>
          </div>
          <p className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
            Organize and manage your lead lists for targeted campaigns
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowIntentDiscovery(true)}
            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              theme === 'gold'
                ? 'border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Target className="h-4 w-4 mr-2" />
            Discover Leads
          </button>
          
          <button
            onClick={() => setShowCreateForm(true)}
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
      </div>

      {/* Error Message */}
      {error && (
        <ErrorMessage
          message={error}
          onDismiss={() => setError('')}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lists Sidebar */}
        <div className={`rounded-xl border ${
          theme === 'gold' 
            ? 'black-card gold-border' 
            : 'bg-white border-gray-200'
        }`}>
          <div className={`p-4 border-b ${
            theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
          }`}>
            <h3 className={`text-lg font-semibold ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              Your Lists ({lists.length})
            </h3>
          </div>
          
          <div className="p-4">
            {lists.length === 0 ? (
              <div className="text-center py-8">
                <Users className={`h-12 w-12 mx-auto mb-4 ${
                  theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
                }`} />
                <h3 className={`text-lg font-medium mb-2 ${
                  theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                }`}>
                  No lists yet
                </h3>
                <p className={`mb-6 ${
                  theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Create your first list to organize leads
                </p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    theme === 'gold'
                      ? 'gold-gradient text-black hover-gold'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create First List
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {lists.map((list) => (
                  <div
                    key={list.id}
                    onClick={() => setSelectedList(list)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedList?.id === list.id
                        ? theme === 'gold'
                          ? 'border-yellow-400 bg-yellow-400/10'
                          : 'border-blue-500 bg-blue-50'
                        : theme === 'gold'
                          ? 'border-yellow-400/20 hover:bg-yellow-400/5'
                          : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-medium truncate ${
                          theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                        }`}>
                          {list.name}
                        </h4>
                        {list.description && (
                          <p className={`text-sm truncate ${
                            theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            {list.description}
                          </p>
                        )}
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`text-xs ${
                            theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                          }`}>
                            {list.lead_count || 0} leads
                          </span>
                          <span className={`text-xs ${
                            theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                          }`}>
                            {new Date(list.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
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
                        title="Delete list"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {selectedList ? (
            <>
              {/* List Header */}
              <div className={`p-6 rounded-xl border ${
                theme === 'gold' 
                  ? 'black-card gold-border' 
                  : 'bg-white border-gray-200'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className={`text-xl font-bold ${
                      theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                    }`}>
                      {selectedList.name}
                    </h2>
                    {selectedList.description && (
                      <p className={`text-sm ${
                        theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {selectedList.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                        theme === 'gold'
                          ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      Upload
                    </button>
                    
                    <button
                      onClick={() => setShowEnrichmentModal(true)}
                      disabled={listLeads.length === 0}
                      className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                        theme === 'gold'
                          ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      } disabled:opacity-50`}
                    >
                      <Sparkles className="h-4 w-4 mr-1" />
                      Enrich
                    </button>
                    
                    <button
                      onClick={() => setShowCleaningModal(true)}
                      disabled={listLeads.length === 0}
                      className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                        theme === 'gold'
                          ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      } disabled:opacity-50`}
                    >
                      <Shield className="h-4 w-4 mr-1" />
                      Clean
                    </button>
                  </div>
                </div>

                {/* Search and Actions */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1 max-w-md">
                    <div className="relative">
                      <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                        theme === 'gold' ? 'text-yellow-400' : 'text-gray-400'
                      }`} />
                      <input
                        type="text"
                        placeholder="Search leads..."
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

                  {selectedLeads.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm ${
                        theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {selectedLeads.length} selected
                      </span>
                      <button
                        onClick={exportLeads}
                        className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                          theme === 'gold'
                            ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                            : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Export
                      </button>
                      <button
                        onClick={() => setShowExportModal(true)}
                        className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                          theme === 'gold'
                            ? 'gold-gradient text-black hover-gold'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        <Send className="h-4 w-4 mr-1" />
                        To Campaign
                      </button>
                      <button
                        onClick={deleteSelectedLeads}
                        className="inline-flex items-center px-3 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Leads Table */}
              <div className={`rounded-xl border ${
                theme === 'gold' 
                  ? 'black-card gold-border' 
                  : 'bg-white border-gray-200'
              }`}>
                {leadsLoading ? (
                  <LoadingSpinner size="md" message="Loading leads..." className="h-32" />
                ) : filteredLeads.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className={`h-12 w-12 mx-auto mb-4 ${
                      theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
                    }`} />
                    <h3 className={`text-lg font-medium mb-2 ${
                      theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                    }`}>
                      {searchTerm ? 'No leads match your search' : 'No leads in this list'}
                    </h3>
                    <p className={`mb-6 ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {searchTerm 
                        ? 'Try adjusting your search terms'
                        : 'Upload leads or discover new prospects to get started'}
                    </p>
                    {!searchTerm && (
                      <div className="flex justify-center space-x-3">
                        <button
                          onClick={() => setShowUploadModal(true)}
                          className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            theme === 'gold'
                              ? 'gold-gradient text-black hover-gold'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Leads
                        </button>
                        <button
                          onClick={() => setShowIntentDiscovery(true)}
                          className={`inline-flex items-center px-4 py-2 text-sm rounded-lg border transition-colors ${
                            theme === 'gold'
                              ? 'border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Target className="h-4 w-4 mr-2" />
                          Discover Leads
                        </button>
                      </div>
                    )}
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
                              Source
                            </th>
                            <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                              theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              Actions
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
                                      {lead.name}
                                    </div>
                                    {lead.job_title && (
                                      <div className={`text-sm ${
                                        theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                                      }`}>
                                        {lead.job_title}
                                      </div>
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
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {lead.company_name ? (
                                  <div className={`flex items-center text-sm ${
                                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                                  }`}>
                                    <Building className="h-3 w-3 mr-2" />
                                    {lead.company_name}
                                  </div>
                                ) : (
                                  <span className={`text-sm ${
                                    theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                                  }`}>
                                    No company
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className={`text-sm ${
                                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                  {lead.source_platform || 'Manual'}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => {
                                      setEditingLead(lead);
                                      setShowEditModal(true);
                                    }}
                                    className={`p-2 rounded-lg transition-colors ${
                                      theme === 'gold'
                                        ? 'text-yellow-400 hover:bg-yellow-400/10'
                                        : 'text-blue-600 hover:bg-blue-100'
                                    }`}
                                    title="Edit lead"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className={`p-12 rounded-xl border text-center ${
              theme === 'gold' 
                ? 'black-card gold-border' 
                : 'bg-white border-gray-200'
            }`}>
              <Users className={`h-16 w-16 mx-auto mb-4 ${
                theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
              }`} />
              <h3 className={`text-xl font-medium mb-2 ${
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

      {/* Create List Modal */}
      {showCreateForm && (
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
                    onClick={() => setShowCreateForm(false)}
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
                    disabled={creating || !newListName.trim()}
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

      {/* Modals */}
      {showUploadModal && selectedList && (
        <LeadUploadModal
          listId={selectedList.id}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            fetchListLeads();
            fetchLists();
          }}
        />
      )}

      {showEditModal && editingLead && selectedList && (
        <LeadEditModal
          lead={editingLead}
          listId={selectedList.id}
          onClose={() => {
            setShowEditModal(false);
            setEditingLead(null);
          }}
          onSave={() => {
            setShowEditModal(false);
            setEditingLead(null);
            fetchListLeads();
          }}
        />
      )}

      {showEnrichmentModal && selectedList && (
        <EnrichmentModal
          listId={selectedList.id}
          leadCount={listLeads.length}
          onClose={() => setShowEnrichmentModal(false)}
          onSuccess={() => {
            setShowEnrichmentModal(false);
            fetchListLeads();
          }}
        />
      )}

      {showCleaningModal && selectedList && (
        <ListCleaningModal
          listId={selectedList.id}
          listName={selectedList.name}
          onClose={() => setShowCleaningModal(false)}
          onSuccess={() => {
            setShowCleaningModal(false);
            fetchListLeads();
            fetchLists();
          }}
        />
      )}

      {showExportModal && selectedList && (
        <ExportToCampaignModal
          listId={selectedList.id}
          selectedLeadIds={selectedLeads}
          onClose={() => setShowExportModal(false)}
          onSuccess={() => {
            setShowExportModal(false);
            setSelectedLeads([]);
          }}
        />
      )}

      {showIntentDiscovery && (
        <div className={`fixed inset-0 z-50 overflow-y-auto ${
          theme === 'gold' ? 'bg-black/75' : 'bg-gray-900/50'
        }`}>
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className={`w-full max-w-4xl rounded-xl shadow-2xl ${
              theme === 'gold' ? 'black-card gold-border' : 'bg-white border border-gray-200'
            }`}>
              <div className={`p-6 border-b ${
                theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <h2 className={`text-xl font-bold ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    AI Lead Discovery
                  </h2>
                  <button
                    onClick={() => setShowIntentDiscovery(false)}
                    className={`p-2 rounded-lg transition-colors ${
                      theme === 'gold'
                        ? 'text-gray-400 hover:bg-gray-800'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <IntentDiscoveryChat
                  onLeadsFound={() => {
                    setShowIntentDiscovery(false);
                    fetchLists();
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}