import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { 
  X, 
  Send, 
  Target, 
  CheckCircle, 
  AlertCircle, 
  Users,
  ArrowRight,
  Crown,
  Zap
} from 'lucide-react';

interface Campaign {
  id: string;
  offer: string | null;
  status: string | null;
  created_at: string;
}

interface ExportToCampaignModalProps {
  listId: string;
  selectedLeadIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportJob {
  id: string;
  leads_selected: number;
  leads_imported: number;
  leads_skipped: number;
  status: string;
  error_message: string | null;
}

export function ExportToCampaignModal({ 
  listId, 
  selectedLeadIds, 
  onClose, 
  onSuccess 
}: ExportToCampaignModalProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [duplicateHandling, setDuplicateHandling] = useState<'skip' | 'update' | 'create_new'>('skip');
  const [importing, setImporting] = useState(false);
  const [importJob, setImportJob] = useState<ImportJob | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [leadsToImport, setLeadsToImport] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchCampaigns();
      fetchLeadsToImport();
    }
  }, [user, listId, selectedLeadIds]);

  const fetchCampaigns = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, offer, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    }
  };

  const fetchLeadsToImport = async () => {
    if (!user) return;

    try {
      let query = supabase
        .from('list_leads')
        .select('*')
        .eq('list_id', listId)
        .eq('user_id', user.id);

      if (selectedLeadIds.length > 0) {
        query = query.in('id', selectedLeadIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLeadsToImport(data || []);
    } catch (error) {
      console.error('Error fetching leads to import:', error);
    }
  };

  const startImport = async () => {
    if (!selectedCampaign || !user) return;

    setImporting(true);
    setResult(null);

    try {
      // Create import job record
      const { data: jobData, error: jobError } = await supabase
        .from('lead_import_jobs')
        .insert([{
          user_id: user.id,
          source_list_id: listId,
          target_campaign_id: selectedCampaign,
          leads_selected: leadsToImport.length,
          duplicate_handling,
          status: 'processing'
        }])
        .select()
        .single();

      if (jobError) throw jobError;
      setImportJob(jobData);

      // Transform and import leads
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const lead of leadsToImport) {
        try {
          // Transform list lead to campaign lead format
          const campaignLead = {
            campaign_id: selectedCampaign,
            user_id: user.id,
            name: lead.name,
            phone: lead.phone || '',
            email: lead.email,
            company_name: lead.company_name,
            job_title: lead.job_title,
            source_url: lead.source_url,
            source_platform: lead.source_platform || 'list_import',
            status: 'pending',
            source_list_id: listId,
            master_lead_id: lead.master_lead_id,
            import_job_id: jobData.id
          };

          // Check for duplicates if needed
          if (duplicateHandling === 'skip') {
            const { data: existing } = await supabase
              .from('uploaded_leads')
              .select('id')
              .eq('campaign_id', selectedCampaign)
              .eq('phone', lead.phone)
              .limit(1);

            if (existing && existing.length > 0) {
              skipped++;
              continue;
            }
          }

          // Insert the lead
          const { error: insertError } = await supabase
            .from('uploaded_leads')
            .insert([campaignLead]);

          if (insertError) {
            if (duplicateHandling === 'skip' && insertError.code === '23505') {
              skipped++;
            } else {
              throw insertError;
            }
          } else {
            imported++;
          }
        } catch (error) {
          console.error('Error importing lead:', error);
          errors.push(`Failed to import ${lead.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Update import job
      await supabase
        .from('lead_import_jobs')
        .update({
          leads_imported: imported,
          leads_skipped: skipped,
          status: errors.length > 0 ? 'completed_with_errors' : 'completed',
          error_message: errors.length > 0 ? errors.join('; ') : null,
          completed_at: new Date().toISOString()
        })
        .eq('id', jobData.id);

      setResult({
        success: true,
        message: `Successfully imported ${imported} leads to campaign. ${skipped > 0 ? `${skipped} duplicates skipped.` : ''}`
      });

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);

    } catch (error) {
      console.error('Error during import:', error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Import failed'
      });

      // Update job status
      if (importJob) {
        await supabase
          .from('lead_import_jobs')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            completed_at: new Date().toISOString()
          })
          .eq('id', importJob.id);
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto ${
      theme === 'gold' ? 'bg-black/75' : 'bg-gray-900/50'
    }`}>
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className={`w-full max-w-2xl rounded-xl shadow-2xl ${
          theme === 'gold' ? 'black-card gold-border' : 'bg-white border border-gray-200'
        }`}>
          {/* Header */}
          <div className={`p-6 border-b ${
            theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  theme === 'gold' ? 'gold-gradient' : 'bg-blue-100'
                }`}>
                  <Send className={`h-6 w-6 ${
                    theme === 'gold' ? 'text-black' : 'text-blue-600'
                  }`} />
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    Export to Campaign
                  </h2>
                  <p className={`text-sm ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Send {selectedLeadIds.length > 0 ? selectedLeadIds.length : leadsToImport.length} leads to a campaign
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
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

          <div className="p-6 space-y-6">
            {/* Campaign Selection */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Select Campaign *
              </label>
              <select
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  theme === 'gold'
                    ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                    : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                }`}
                required
              >
                <option value="">Choose a campaign...</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.offer || 'Untitled Campaign'} ({campaign.status || 'draft'})
                  </option>
                ))}
              </select>
            </div>

            {/* Duplicate Handling */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Handle Duplicates
              </label>
              <div className="space-y-2">
                {[
                  { value: 'skip', label: 'Skip duplicates', desc: 'Don\'t import leads that already exist in the campaign' },
                  { value: 'update', label: 'Update existing', desc: 'Update existing leads with new information' },
                  { value: 'create_new', label: 'Create new entries', desc: 'Import all leads, even if duplicates exist' }
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      duplicateHandling === option.value
                        ? theme === 'gold'
                          ? 'border-yellow-400 bg-yellow-400/10'
                          : 'border-blue-500 bg-blue-50'
                        : theme === 'gold'
                          ? 'border-gray-600 hover:border-gray-500'
                          : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="duplicateHandling"
                      value={option.value}
                      checked={duplicateHandling === option.value}
                      onChange={(e) => setDuplicateHandling(e.target.value as any)}
                      className="mt-1"
                    />
                    <div>
                      <div className={`text-sm font-medium ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        {option.label}
                      </div>
                      <div className={`text-xs ${
                        theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {option.desc}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Import Preview */}
            <div className={`p-4 rounded-lg border ${
              theme === 'gold'
                ? 'border-yellow-400/20 bg-yellow-400/5'
                : 'border-blue-200 bg-blue-50'
            }`}>
              <h4 className={`text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
              }`}>
                Import Preview
              </h4>
              <div className="flex items-center space-x-2 text-sm">
                <Users className={`h-4 w-4 ${
                  theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                }`} />
                <span className={theme === 'gold' ? 'text-yellow-300' : 'text-blue-600'}>
                  {leadsToImport.length} leads will be imported
                </span>
                <ArrowRight className={`h-4 w-4 ${
                  theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                }`} />
                <Target className={`h-4 w-4 ${
                  theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                }`} />
                <span className={theme === 'gold' ? 'text-yellow-300' : 'text-blue-600'}>
                  {campaigns.find(c => c.id === selectedCampaign)?.offer || 'Selected campaign'}
                </span>
              </div>
            </div>

            {/* Result Message */}
            {result && (
              <div className={`rounded-lg border p-4 ${
                result.success 
                  ? theme === 'gold'
                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                    : 'bg-green-50 border-green-200 text-green-800'
                  : theme === 'gold'
                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    {result.success ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <AlertCircle className="h-5 w-5" />
                    )}
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium">{result.message}</p>
                    {importJob && (
                      <div className="text-xs mt-1">
                        Imported: {importJob.leads_imported} | Skipped: {importJob.leads_skipped}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={importing}
                className={`flex-1 px-4 py-2 text-sm rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                    : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                } disabled:opacity-50`}
              >
                Cancel
              </button>
              <button
                onClick={startImport}
                disabled={importing || !selectedCampaign || leadsToImport.length === 0}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'gold-gradient text-black hover-gold'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } disabled:opacity-50`}
              >
                {importing ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    Importing...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <Send className="h-4 w-4 mr-2" />
                    Import {leadsToImport.length} Leads
                  </div>
                )}
              </button>
            </div>

            {/* Import Guidelines */}
            <div className={`p-3 rounded-lg ${
              theme === 'gold'
                ? 'bg-gray-500/10 border border-gray-500/20'
                : 'bg-gray-50 border border-gray-200'
            }`}>
              <h5 className={`text-xs font-medium mb-1 ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Import Guidelines:
              </h5>
              <ul className={`text-xs space-y-1 ${
                theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
              }`}>
                <li>• Leads will be added to the selected campaign for outreach</li>
                <li>• Source information and intent scores are preserved</li>
                <li>• Duplicate detection is based on phone number</li>
                <li>• Import history is tracked for audit purposes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}