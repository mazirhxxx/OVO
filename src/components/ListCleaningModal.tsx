import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { 
  X, 
  Sparkles, 
  CheckCircle, 
  AlertCircle, 
  Users,
  Phone,
  Mail,
  Building,
  Trash2,
  RefreshCw,
  Play,
  Crown,
  Zap,
  BarChart3,
  Target, 
  Filter
} from 'lucide-react';

interface ListCleaningModalProps {
  listId: string;
  listName: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface CleaningAnalysis {
  totalLeads: number;
  duplicatePhones: number;
  duplicateEmails: number;
  invalidPhones: number;
  invalidEmails: number;
  missingPhones: number;
  missingEmails: number;
  missingNames: number;
  missingCompanies: number;
  phoneIssues: Array<{
    id: string;
    name: string;
    phone: string;
    issue: string;
    suggestedFix: string;
  }>;
  emailIssues: Array<{
    id: string;
    name: string;
    email: string;
    issue: string;
    suggestedFix: string;
  }>;
  duplicateGroups: Array<{
    type: 'phone' | 'email';
    value: string;
    count: number;
    leadIds: string[];
  }>;
}

interface CleaningProgress {
  step: string;
  completed: number;
  total: number;
  currentAction: string;
}

export function ListCleaningModal({ listId, listName, onClose, onSuccess }: ListCleaningModalProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [analysis, setAnalysis] = useState<CleaningAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [progress, setProgress] = useState<CleaningProgress | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
  const [selectedCleaningOptions, setSelectedCleaningOptions] = useState({
    fixPhoneFormats: true,
    removeDuplicatePhones: true,
    removeDuplicateEmails: true,
    fixEmailFormats: true,
    removeEmptyLeads: true,
    standardizeNames: true,
    cleanCompanyNames: true
  });
  const [avatarDescription, setAvatarDescription] = useState('');
  const [verifyingAvatar, setVerifyingAvatar] = useState(false);
  const [avatarVerificationResult, setAvatarVerificationResult] = useState<{ success: boolean; message: string; summary?: any } | null>(null);

  useEffect(() => {
    if (listId) {
      analyzeList();
    }
  }, [listId]);

  const analyzeList = async () => {
    if (!user) return;

    setAnalyzing(true);
    try {
      const { data: leads, error } = await supabase
        .from('list_leads')
        .select('*')
        .eq('list_id', listId)
        .eq('user_id', user.id);

      if (error) throw error;

      const analysis = analyzeLeadsData(leads || []);
      setAnalysis(analysis);
    } catch (error) {
      console.error('Error analyzing list:', error);
      setResult({
        success: false,
        message: 'Failed to analyze list data'
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzeLeadsData = (leads: any[]): CleaningAnalysis => {
    const phoneMap = new Map<string, string[]>();
    const emailMap = new Map<string, string[]>();
    const phoneIssues: any[] = [];
    const emailIssues: any[] = [];
    
    let invalidPhones = 0;
    let invalidEmails = 0;
    let missingPhones = 0;
    let missingEmails = 0;
    let missingNames = 0;
    let missingCompanies = 0;

    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    leads.forEach(lead => {
      // Analyze names
      if (!lead.name || lead.name.trim() === '' || lead.name === 'Unnamed Lead') {
        missingNames++;
      }

      // Analyze companies
      if (!lead.company_name || lead.company_name.trim() === '') {
        missingCompanies++;
      }

      // Analyze phones
      if (!lead.phone || lead.phone.trim() === '') {
        missingPhones++;
      } else {
        const cleanPhone = lead.phone.replace(/\s/g, '');
        
        // Check for duplicates
        if (phoneMap.has(cleanPhone)) {
          phoneMap.get(cleanPhone)!.push(lead.id);
        } else {
          phoneMap.set(cleanPhone, [lead.id]);
        }

        // Check format issues
        if (!phoneRegex.test(lead.phone)) {
          invalidPhones++;
          let suggestedFix = lead.phone;
          
          // Suggest adding country code
          if (/^\d{10}$/.test(cleanPhone)) {
            suggestedFix = `+1${cleanPhone}`;
          } else if (/^1\d{10}$/.test(cleanPhone)) {
            suggestedFix = `+${cleanPhone}`;
          } else if (!cleanPhone.startsWith('+')) {
            suggestedFix = `+1${cleanPhone}`;
          }

          phoneIssues.push({
            id: lead.id,
            name: lead.name || 'Unknown',
            phone: lead.phone,
            issue: 'Invalid format',
            suggestedFix
          });
        }
      }

      // Analyze emails
      if (!lead.email || lead.email.trim() === '') {
        missingEmails++;
      } else {
        const cleanEmail = lead.email.toLowerCase().trim();
        
        // Check for duplicates
        if (emailMap.has(cleanEmail)) {
          emailMap.get(cleanEmail)!.push(lead.id);
        } else {
          emailMap.set(cleanEmail, [lead.id]);
        }

        // Check format issues
        if (!emailRegex.test(lead.email)) {
          invalidEmails++;
          emailIssues.push({
            id: lead.id,
            name: lead.name || 'Unknown',
            email: lead.email,
            issue: 'Invalid format',
            suggestedFix: lead.email.toLowerCase().trim()
          });
        }
      }
    });

    // Find duplicate groups
    const duplicateGroups: any[] = [];
    
    phoneMap.forEach((leadIds, phone) => {
      if (leadIds.length > 1) {
        duplicateGroups.push({
          type: 'phone',
          value: phone,
          count: leadIds.length,
          leadIds
        });
      }
    });

    emailMap.forEach((leadIds, email) => {
      if (leadIds.length > 1) {
        duplicateGroups.push({
          type: 'email',
          value: email,
          count: leadIds.length,
          leadIds
        });
      }
    });

    return {
      totalLeads: leads.length,
      duplicatePhones: duplicateGroups.filter(g => g.type === 'phone').reduce((sum, g) => sum + g.count - 1, 0),
      duplicateEmails: duplicateGroups.filter(g => g.type === 'email').reduce((sum, g) => sum + g.count - 1, 0),
      invalidPhones,
      invalidEmails,
      missingPhones,
      missingEmails,
      missingNames,
      missingCompanies,
      phoneIssues: phoneIssues.slice(0, 10),
      emailIssues: emailIssues.slice(0, 10),
      duplicateGroups: duplicateGroups.slice(0, 10)
    };
  };

  const executeListCleaning = async () => {
    if (!user || !analysis) return;

    setCleaning(true);
    setResult(null);
    
    try {
      let totalOperations = 0;
      let completedOperations = 0;

      // Count total operations
      if (selectedCleaningOptions.fixPhoneFormats) totalOperations += analysis.phoneIssues.length;
      if (selectedCleaningOptions.removeDuplicatePhones) totalOperations += analysis.duplicateGroups.filter(g => g.type === 'phone').length;
      if (selectedCleaningOptions.removeDuplicateEmails) totalOperations += analysis.duplicateGroups.filter(g => g.type === 'email').length;
      if (selectedCleaningOptions.fixEmailFormats) totalOperations += analysis.emailIssues.length;
      if (selectedCleaningOptions.removeEmptyLeads) totalOperations += analysis.missingPhones + analysis.missingEmails;

      // Fix phone formats
      if (selectedCleaningOptions.fixPhoneFormats) {
        setProgress({
          step: 'Fixing phone formats',
          completed: completedOperations,
          total: totalOperations,
          currentAction: 'Standardizing phone numbers...'
        });

        for (const phoneIssue of analysis.phoneIssues) {
          await supabase
            .from('list_leads')
            .update({ phone: phoneIssue.suggestedFix })
            .eq('id', phoneIssue.id)
            .eq('user_id', user.id);
          
          completedOperations++;
          setProgress(prev => prev ? { ...prev, completed: completedOperations } : null);
        }
      }

      // Remove duplicate phones (keep first, remove others)
      if (selectedCleaningOptions.removeDuplicatePhones) {
        setProgress({
          step: 'Removing duplicate phones',
          completed: completedOperations,
          total: totalOperations,
          currentAction: 'Removing duplicate phone numbers...'
        });

        for (const duplicateGroup of analysis.duplicateGroups.filter(g => g.type === 'phone')) {
          // Keep first lead, remove others
          const leadsToRemove = duplicateGroup.leadIds.slice(1);
          
          if (leadsToRemove.length > 0) {
            await supabase
              .from('list_leads')
              .delete()
              .in('id', leadsToRemove)
              .eq('user_id', user.id);
          }
          
          completedOperations++;
          setProgress(prev => prev ? { ...prev, completed: completedOperations } : null);
        }
      }

      // Remove duplicate emails (keep first, remove others)
      if (selectedCleaningOptions.removeDuplicateEmails) {
        setProgress({
          step: 'Removing duplicate emails',
          completed: completedOperations,
          total: totalOperations,
          currentAction: 'Removing duplicate email addresses...'
        });

        for (const duplicateGroup of analysis.duplicateGroups.filter(g => g.type === 'email')) {
          // Keep first lead, remove others
          const leadsToRemove = duplicateGroup.leadIds.slice(1);
          
          if (leadsToRemove.length > 0) {
            await supabase
              .from('list_leads')
              .delete()
              .in('id', leadsToRemove)
              .eq('user_id', user.id);
          }
          
          completedOperations++;
          setProgress(prev => prev ? { ...prev, completed: completedOperations } : null);
        }
      }

      // Fix email formats
      if (selectedCleaningOptions.fixEmailFormats) {
        setProgress({
          step: 'Fixing email formats',
          completed: completedOperations,
          total: totalOperations,
          currentAction: 'Standardizing email addresses...'
        });

        for (const emailIssue of analysis.emailIssues) {
          await supabase
            .from('list_leads')
            .update({ email: emailIssue.suggestedFix })
            .eq('id', emailIssue.id)
            .eq('user_id', user.id);
          
          completedOperations++;
          setProgress(prev => prev ? { ...prev, completed: completedOperations } : null);
        }
      }

      // Remove leads with no contact info
      if (selectedCleaningOptions.removeEmptyLeads) {
        setProgress({
          step: 'Removing empty leads',
          completed: completedOperations,
          total: totalOperations,
          currentAction: 'Removing leads with no contact information...'
        });

        await supabase
          .from('list_leads')
          .delete()
          .eq('list_id', listId)
          .eq('user_id', user.id)
          .or('phone.is.null,phone.eq.')
          .or('email.is.null,email.eq.');
        
        completedOperations = totalOperations;
        setProgress(prev => prev ? { ...prev, completed: completedOperations } : null);
      }

      // Standardize names
      if (selectedCleaningOptions.standardizeNames) {
        setProgress({
          step: 'Standardizing names',
          completed: completedOperations,
          total: totalOperations,
          currentAction: 'Standardizing name formats...'
        });

        const { data: leadsWithBadNames } = await supabase
          .from('list_leads')
          .select('id, name')
          .eq('list_id', listId)
          .eq('user_id', user.id)
          .or('name.is.null,name.eq.,name.eq.Unnamed Lead');

        if (leadsWithBadNames) {
          for (const lead of leadsWithBadNames) {
            const standardizedName = lead.name ? 
              lead.name.split(' ').map((word: string) => 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
              ).join(' ') : 
              'Unknown Lead';

            await supabase
              .from('list_leads')
              .update({ name: standardizedName })
              .eq('id', lead.id);
          }
        }
      }

      setResult({
        success: true,
        message: `List cleaned successfully! Processed ${totalOperations} operations.`,
        details: {
          phoneFixed: selectedCleaningOptions.fixPhoneFormats ? analysis.phoneIssues.length : 0,
          duplicatesRemoved: (selectedCleaningOptions.removeDuplicatePhones ? analysis.duplicatePhones : 0) + 
                           (selectedCleaningOptions.removeDuplicateEmails ? analysis.duplicateEmails : 0),
          emailsFixed: selectedCleaningOptions.fixEmailFormats ? analysis.emailIssues.length : 0
        }
      });

      // Re-analyze after cleaning
      setTimeout(() => {
        analyzeList();
      }, 1000);

    } catch (error) {
      console.error('Error cleaning list:', error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'List cleaning failed'
      });
    } finally {
      setCleaning(false);
      setProgress(null);
    }
  };

  const executeAvatarVerification = async () => {
    if (!user || !avatarDescription.trim()) {
      setResult({
        success: false,
        message: 'Please provide an avatar description'
      });
      return;
    }

    setVerifyingAvatar(true);
    setResult(null);

    try {
      // Get all leads from the list for verification
      const { data: allLeads, error: leadsError } = await supabase
        .from('list_leads')
        .select('*')
        .eq('list_id', listId)
        .eq('user_id', user.id);

      if (leadsError) throw leadsError;

      if (!allLeads || allLeads.length === 0) {
        throw new Error('No leads found in this list');
      }

      // Generate batch ID
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const avatarId = `avatar_${Date.now()}`;

      // Create avatar spec
      const avatarSpec = {
        description: avatarDescription.trim(),
        created_at: new Date().toISOString(),
        list_id: listId,
        list_name: listName
      };

      // Create cleaning session record
      const { data: sessionData, error: sessionError } = await supabase
        .from('cleaning_sessions')
        .insert({
          owner_id: user.id,
          avatar_spec: avatarSpec,
          avatar_id: avatarId,
          batch_id: batchId,
          batch_size: 500,
          lead_count: allLeads.length,
          status: 'queued'
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Clean and normalize leads before sending
      const cleanedLeads = allLeads.map(lead => ({
        id: lead.id,
        emails: lead.email ? [lead.email.toLowerCase().trim()] : [],
        phones: lead.phone ? [lead.phone.replace(/\s/g, '')] : [],
        full_name: lead.name || '',
        first_name: lead.name ? lead.name.split(' ')[0] : '',
        last_name: lead.name ? lead.name.split(' ').slice(1).join(' ') : '',
        title: lead.job_title || '',
        company: lead.company_name || '',
        company_domain: lead.source_url ? new URL(lead.source_url).hostname : '',
        linkedin_url: lead.source_url || '',
        source_slug: lead.source_platform || 'manual',
        country: lead.custom_fields?.country || '',
        state: lead.custom_fields?.state || '',
        city: lead.custom_fields?.city || ''
      })).filter(lead => lead.id); // Only include leads with valid IDs

      // Update session to running
      await supabase
        .from('cleaning_sessions')
        .update({ 
          status: 'running',
          started_at: new Date().toISOString()
        })
        .eq('id', sessionData.id);

      // Send to n8n webhook
      const webhookPayload = {
        avatar: avatarSpec,
        avatar_id: avatarId,
        batch_id: batchId,
        batch_size: 500,
        leads: cleanedLeads
      };

      const response = await fetch('https://mazirhx.app.n8n.cloud/webhook/verify-discovered', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      }

      const webhookResult = await response.json();

      // Update session with completion
      await supabase
        .from('cleaning_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          summary: webhookResult
        })
        .eq('id', sessionData.id);

      setAvatarVerificationResult({
        success: true,
        message: `Avatar verification completed! Processed ${cleanedLeads.length} leads.`,
        summary: webhookResult
      });

      setResult({
        success: true,
        message: `Avatar verification completed! ${webhookResult.summary?.accept_count || 0} ACCEPT, ${webhookResult.summary?.review_count || 0} REVIEW, ${webhookResult.summary?.reject_count || 0} REJECT. Average score: ${webhookResult.summary?.average_score?.toFixed(2) || 'N/A'}`
      });

    } catch (error) {
      console.error('Error during avatar verification:', error);
      
      // Update session to failed if it was created
      if (sessionData) {
        await supabase
          .from('cleaning_sessions')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            summary: { error: error instanceof Error ? error.message : 'Unknown error' }
          })
          .eq('id', sessionData.id);
      }

      setResult({
        success: false,
        message: `Avatar verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setVerifyingAvatar(false);
    }
  };

  const executeAvatarVerification = async () => {
    if (!user || !avatarDescription.trim()) {
      setResult({
        success: false,
        message: 'Please provide an avatar description'
      });
      return;
    }

    setVerifyingAvatar(true);
    setResult(null);

    try {
      // Get all leads from the list for verification
      const { data: allLeads, error: leadsError } = await supabase
        .from('list_leads')
        .select('*')
        .eq('list_id', listId)
        .eq('user_id', user.id);

      if (leadsError) throw leadsError;

      if (!allLeads || allLeads.length === 0) {
        throw new Error('No leads found in this list');
      }

      // Generate batch ID
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const avatarId = `avatar_${Date.now()}`;

      // Create avatar spec
      const avatarSpec = {
        description: avatarDescription.trim(),
        created_at: new Date().toISOString(),
        list_id: listId,
        list_name: listName
      };

      // Create cleaning session record
      const { data: sessionData, error: sessionError } = await supabase
        .from('cleaning_sessions')
        .insert({
          owner_id: user.id,
          avatar_spec: avatarSpec,
          avatar_id: avatarId,
          batch_id: batchId,
          batch_size: 500,
          lead_count: allLeads.length,
          status: 'queued'
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Clean and normalize leads before sending
      const cleanedLeads = allLeads.map(lead => ({
        id: lead.id,
        emails: lead.email ? [lead.email.toLowerCase().trim()] : [],
        phones: lead.phone ? [lead.phone.replace(/\s/g, '')] : [],
        full_name: lead.name || '',
        first_name: lead.name ? lead.name.split(' ')[0] : '',
        last_name: lead.name ? lead.name.split(' ').slice(1).join(' ') : '',
        title: lead.job_title || '',
        company: lead.company_name || '',
        company_domain: lead.source_url ? new URL(lead.source_url).hostname : '',
        linkedin_url: lead.source_url || '',
        source_slug: lead.source_platform || 'manual',
        country: lead.custom_fields?.country || '',
        state: lead.custom_fields?.state || '',
        city: lead.custom_fields?.city || ''
      })).filter(lead => lead.id); // Only include leads with valid IDs

      // Update session to running
      await supabase
        .from('cleaning_sessions')
        .update({ 
          status: 'running',
          started_at: new Date().toISOString()
        })
        .eq('id', sessionData.id);

      // Send to n8n webhook
      const webhookPayload = {
        avatar: avatarSpec,
        avatar_id: avatarId,
        batch_id: batchId,
        batch_size: 500,
        leads: cleanedLeads
      };

      const response = await fetch('https://mazirhx.app.n8n.cloud/webhook/verify-discovered', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      }

      const webhookResult = await response.json();

      // Update session with completion
      await supabase
        .from('cleaning_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          summary: webhookResult
        })
        .eq('id', sessionData.id);

      setAvatarVerificationResult({
        success: true,
        message: `Avatar verification completed! Processed ${cleanedLeads.length} leads.`,
        summary: webhookResult
      });

      setResult({
        success: true,
        message: `Avatar verification completed! ${webhookResult.summary?.accept_count || 0} ACCEPT, ${webhookResult.summary?.review_count || 0} REVIEW, ${webhookResult.summary?.reject_count || 0} REJECT. Average score: ${webhookResult.summary?.average_score?.toFixed(2) || 'N/A'}`
      });

    } catch (error) {
      console.error('Error during avatar verification:', error);
      
      // Update session to failed if it was created
      if (sessionData) {
        await supabase
          .from('cleaning_sessions')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            summary: { error: error instanceof Error ? error.message : 'Unknown error' }
          })
          .eq('id', sessionData.id);
      }

      setResult({
        success: false,
        message: `Avatar verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setVerifyingAvatar(false);
    }
  };

  const getQualityScore = () => {
    if (!analysis) return 0;
    
    const totalIssues = analysis.duplicatePhones + analysis.duplicateEmails + 
                       analysis.invalidPhones + analysis.invalidEmails + 
                       analysis.missingPhones + analysis.missingEmails;
    
    const maxPossibleIssues = analysis.totalLeads * 6; // 6 potential issues per lead
    const qualityScore = Math.max(0, Math.min(100, ((maxPossibleIssues - totalIssues) / maxPossibleIssues) * 100));
    
    return Math.round(qualityScore);
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return theme === 'gold' ? 'text-green-400' : 'text-green-600';
    if (score >= 60) return theme === 'gold' ? 'text-yellow-400' : 'text-yellow-600';
    return theme === 'gold' ? 'text-red-400' : 'text-red-600';
  };

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto ${
      theme === 'gold' ? 'bg-black/75' : 'bg-gray-900/50'
    }`}>
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className={`w-full max-w-4xl rounded-xl shadow-2xl ${
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
                  <Sparkles className={`h-6 w-6 ${
                    theme === 'gold' ? 'text-black' : 'text-blue-600'
                  }`} />
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    Clean List: {listName}
                  </h2>
                  <p className={`text-sm ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Analyze and clean your lead data for better campaign performance
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

          <div className="p-6 max-h-[80vh] overflow-y-auto space-y-6">
            {/* Analysis Results */}
            {analyzing ? (
              <div className="text-center py-12">
                <div className={`animate-spin rounded-full h-12 w-12 border-4 border-transparent mx-auto mb-4 ${
                  theme === 'gold' ? 'border-t-yellow-400' : 'border-t-blue-600'
                }`}></div>
                <p className={`text-sm ${
                  theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Analyzing list data quality...
                </p>
              </div>
            ) : analysis ? (
              <>
                {/* Quality Score */}
                <div className={`p-6 rounded-lg border text-center ${
                  theme === 'gold'
                    ? 'border-yellow-400/20 bg-black/20'
                    : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className={`text-4xl font-bold mb-2 ${getQualityColor(getQualityScore())}`}>
                    {getQualityScore()}%
                  </div>
                  <div className={`text-sm font-medium ${
                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Data Quality Score
                  </div>
                  <div className={`text-xs mt-1 ${
                    theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                  }`}>
                    {analysis.totalLeads} total leads analyzed
                  </div>
                </div>

                {/* Issues Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className={`p-4 rounded-lg border ${
                    theme === 'gold'
                      ? 'border-red-500/20 bg-red-500/5'
                      : 'border-red-200 bg-red-50'
                  }`}>
                    <div className={`text-lg font-bold ${
                      theme === 'gold' ? 'text-red-400' : 'text-red-600'
                    }`}>
                      {analysis.duplicatePhones + analysis.duplicateEmails}
                    </div>
                    <div className={`text-sm ${
                      theme === 'gold' ? 'text-red-300' : 'text-red-700'
                    }`}>
                      Duplicates
                    </div>
                  </div>

                  <div className={`p-4 rounded-lg border ${
                    theme === 'gold'
                      ? 'border-orange-500/20 bg-orange-500/5'
                      : 'border-orange-200 bg-orange-50'
                  }`}>
                    <div className={`text-lg font-bold ${
                      theme === 'gold' ? 'text-orange-400' : 'text-orange-600'
                    }`}>
                      {analysis.invalidPhones + analysis.invalidEmails}
                    </div>
                    <div className={`text-sm ${
                      theme === 'gold' ? 'text-orange-300' : 'text-orange-700'
                    }`}>
                      Invalid Formats
                    </div>
                  </div>

                  <div className={`p-4 rounded-lg border ${
                    theme === 'gold'
                      ? 'border-yellow-500/20 bg-yellow-500/5'
                      : 'border-yellow-200 bg-yellow-50'
                  }`}>
                    <div className={`text-lg font-bold ${
                      theme === 'gold' ? 'text-yellow-400' : 'text-yellow-600'
                    }`}>
                      {analysis.missingPhones + analysis.missingEmails}
                    </div>
                    <div className={`text-sm ${
                      theme === 'gold' ? 'text-yellow-300' : 'text-yellow-700'
                    }`}>
                      Missing Contact Info
                    </div>
                  </div>

                  <div className={`p-4 rounded-lg border ${
                    theme === 'gold'
                      ? 'border-blue-500/20 bg-blue-500/5'
                      : 'border-blue-200 bg-blue-50'
                  }`}>
                    <div className={`text-lg font-bold ${
                      theme === 'gold' ? 'text-blue-400' : 'text-blue-600'
                    }`}>
                      {analysis.missingNames + analysis.missingCompanies}
                    </div>
                    <div className={`text-sm ${
                      theme === 'gold' ? 'text-blue-300' : 'text-blue-700'
                    }`}>
                      Missing Info
                    </div>
                  </div>
                </div>

                {/* Cleaning Options */}
                <div className={`p-6 rounded-lg border ${
                  theme === 'gold'
                    ? 'border-yellow-400/20 bg-black/20'
                    : 'border-gray-200 bg-gray-50'
                }`}>
                  <h3 className={`text-lg font-semibold mb-4 ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    Cleaning Options
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      {
                        key: 'fixPhoneFormats',
                        label: 'Fix Phone Formats',
                        description: `Add country codes and standardize ${analysis.invalidPhones} phone numbers`,
                        count: analysis.invalidPhones,
                        icon: Phone
                      },
                      {
                        key: 'removeDuplicatePhones',
                        label: 'Remove Duplicate Phones',
                        description: `Remove ${analysis.duplicatePhones} duplicate phone numbers`,
                        count: analysis.duplicatePhones,
                        icon: Phone
                      },
                      {
                        key: 'removeDuplicateEmails',
                        label: 'Remove Duplicate Emails',
                        description: `Remove ${analysis.duplicateEmails} duplicate email addresses`,
                        count: analysis.duplicateEmails,
                        icon: Mail
                      },
                      {
                        key: 'fixEmailFormats',
                        label: 'Fix Email Formats',
                        description: `Standardize ${analysis.invalidEmails} email addresses`,
                        count: analysis.invalidEmails,
                        icon: Mail
                      },
                      {
                        key: 'removeEmptyLeads',
                        label: 'Remove Empty Leads',
                        description: `Remove leads with no phone or email`,
                        count: analysis.missingPhones + analysis.missingEmails,
                        icon: Trash2
                      },
                      {
                        key: 'standardizeNames',
                        label: 'Standardize Names',
                        description: `Fix capitalization and formatting`,
                        count: analysis.missingNames,
                        icon: Users
                      }
                    ].map((option) => {
                      const Icon = option.icon;
                      const isSelected = selectedCleaningOptions[option.key as keyof typeof selectedCleaningOptions];
                      
                      return (
                        <label
                          key={option.key}
                          className={`flex items-start space-x-3 p-4 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? theme === 'gold'
                                ? 'border-yellow-400 bg-yellow-400/10'
                                : 'border-blue-500 bg-blue-50'
                              : theme === 'gold'
                                ? 'border-gray-600 hover:border-gray-500'
                                : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => setSelectedCleaningOptions(prev => ({
                              ...prev,
                              [option.key]: e.target.checked
                            }))}
                            className="mt-1"
                          />
                          <Icon className={`h-5 w-5 mt-0.5 ${
                            theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                          }`} />
                          <div className="flex-1">
                            <div className={`text-sm font-medium ${
                              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                            }`}>
                              {option.label}
                              {option.count > 0 && (
                                <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                                  theme === 'gold'
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {option.count}
                                </span>
                              )}
                            </div>
                            <div className={`text-xs ${
                              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              {option.description}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Avatar Verification Section */}
                <div className={`p-6 rounded-lg border ${
                  theme === 'gold'
                    ? 'border-purple-500/20 bg-purple-500/5'
                    : 'border-purple-200 bg-purple-50'
                }`}>
                  <h3 className={`text-lg font-semibold mb-4 ${
                    theme === 'gold' ? 'text-purple-400' : 'text-purple-700'
                  }`}>
                    🎯 Avatar Verification
                  </h3>
                  <p className={`text-sm mb-4 ${
                    theme === 'gold' ? 'text-purple-300' : 'text-purple-600'
                  }`}>
                    Verify which leads match your ideal client avatar using AI scoring
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Describe Your Ideal Client Avatar
                      </label>
                      <textarea
                        value={avatarDescription}
                        onChange={(e) => setAvatarDescription(e.target.value)}
                        rows={4}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                          theme === 'gold'
                            ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                            : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                        }`}
                        placeholder="Example: US wealth managers, 20-200 employees, must use HubSpot, hiring SDRs, located in major cities, revenue $10M+..."
                      />
                      <p className={`text-xs mt-1 ${
                        theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                      }`}>
                        Be specific about industry, company size, tech stack, hiring signals, location, etc.
                      </p>
                    </div>
                    
                    <button
                      onClick={executeAvatarVerification}
                      disabled={verifyingAvatar || !avatarDescription.trim()}
                      className={`w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                        theme === 'gold'
                          ? 'bg-purple-600 text-white hover:bg-purple-700'
                          : 'bg-purple-600 text-white hover:bg-purple-700'
                      } disabled:opacity-50`}
                    >
                      {verifyingAvatar ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Verifying Avatar Match...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <Target className="h-4 w-4 mr-2" />
                          Verify Avatar Match ({analysis?.totalLeads || 0} leads)
                        </div>
                      )}
                    </button>
                  </div>
                </div>

                {/* Avatar Verification Result */}
                {avatarVerificationResult && (
                  <div className={`p-4 rounded-lg border ${
                    avatarVerificationResult.success 
                      ? theme === 'gold'
                        ? 'bg-green-500/10 border-green-500/30 text-green-400'
                        : 'bg-green-50 border-green-200 text-green-800'
                      : theme === 'gold'
                        ? 'bg-red-500/10 border-red-500/30 text-red-400'
                        : 'bg-red-50 border-red-200 text-red-800'
                  }`}>
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        {avatarVerificationResult.success ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <AlertCircle className="h-5 w-5" />
                        )}
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium">{avatarVerificationResult.message}</p>
                        {avatarVerificationResult.summary && (
                          <div className="text-xs mt-2 space-y-1">
                            <div>ACCEPT: {avatarVerificationResult.summary.accept_count || 0}</div>
                            <div>REVIEW: {avatarVerificationResult.summary.review_count || 0}</div>
                            <div>REJECT: {avatarVerificationResult.summary.reject_count || 0}</div>
                            <div>Average Score: {avatarVerificationResult.summary.average_score?.toFixed(2) || 'N/A'}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {/* Sample Issues Preview */}
                {(analysis.phoneIssues.length > 0 || analysis.emailIssues.length > 0 || analysis.duplicateGroups.length > 0) && (
                  <div className={`p-6 rounded-lg border ${
                    theme === 'gold'
                      ? 'border-yellow-400/20 bg-black/20'
                      : 'border-gray-200 bg-gray-50'
                  }`}>
                    <h4 className={`text-md font-semibold mb-4 ${
                      theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                    }`}>
                      Sample Issues Found
                    </h4>

                    {/* Phone Issues */}
                    {analysis.phoneIssues.length > 0 && (
                      <div className="mb-4">
                        <h5 className={`text-sm font-medium mb-2 ${
                          theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Phone Format Issues (showing first 5)
                        </h5>
                        <div className="space-y-2">
                          {analysis.phoneIssues.slice(0, 5).map((issue, index) => (
                            <div key={index} className={`p-3 rounded-lg ${
                              theme === 'gold' ? 'bg-black/30' : 'bg-white'
                            }`}>
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className={`text-sm font-medium ${
                                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                                  }`}>
                                    {issue.name}
                                  </div>
                                  <div className={`text-xs ${
                                    theme === 'gold' ? 'text-red-400' : 'text-red-600'
                                  }`}>
                                    Current: {issue.phone}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-xs ${
                                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                                  }`}>
                                    Will fix to:
                                  </div>
                                  <div className={`text-sm font-medium ${
                                    theme === 'gold' ? 'text-green-400' : 'text-green-600'
                                  }`}>
                                    {issue.suggestedFix}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Duplicate Groups */}
                    {analysis.duplicateGroups.length > 0 && (
                      <div className="mb-4">
                        <h5 className={`text-sm font-medium mb-2 ${
                          theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Duplicate Groups (showing first 5)
                        </h5>
                        <div className="space-y-2">
                          {analysis.duplicateGroups.slice(0, 5).map((group, index) => (
                            <div key={index} className={`p-3 rounded-lg ${
                              theme === 'gold' ? 'bg-black/30' : 'bg-white'
                            }`}>
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className={`text-sm font-medium ${
                                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                                  }`}>
                                    {group.type === 'phone' ? '📞' : '📧'} {group.value}
                                  </div>
                                  <div className={`text-xs ${
                                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                                  }`}>
                                    Found in {group.count} leads
                                  </div>
                                </div>
                                <div className={`text-xs px-2 py-1 rounded-full ${
                                  theme === 'gold'
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  Will keep 1, remove {group.count - 1}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Cleaning Progress */}
                {cleaning && progress && (
                  <div className={`p-6 rounded-lg border ${
                    theme === 'gold'
                      ? 'border-blue-500/30 bg-blue-500/10'
                      : 'border-blue-200 bg-blue-50'
                  }`}>
                    <div className="flex items-center space-x-3 mb-4">
                      <div className={`animate-spin rounded-full h-5 w-5 border-2 border-transparent ${
                        theme === 'gold' ? 'border-t-yellow-400' : 'border-t-blue-600'
                      }`}></div>
                      <div>
                        <div className={`text-sm font-medium ${
                          theme === 'gold' ? 'text-blue-400' : 'text-blue-700'
                        }`}>
                          {progress.step}
                        </div>
                        <div className={`text-xs ${
                          theme === 'gold' ? 'text-blue-300' : 'text-blue-600'
                        }`}>
                          {progress.currentAction}
                        </div>
                      </div>
                    </div>
                    
                    <div className={`w-full bg-gray-200 rounded-full h-2 ${
                      theme === 'gold' ? 'bg-gray-700' : 'bg-gray-200'
                    }`}>
                      <div
                        className={`h-2 rounded-full transition-all ${
                          theme === 'gold' ? 'gold-gradient' : 'bg-blue-600'
                        }`}
                        style={{
                          width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%`
                        }}
                      />
                    </div>
                    
                    <div className={`text-xs mt-2 text-center ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {progress.completed} of {progress.total} operations completed
                    </div>
                  </div>
                )}

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
                        {result.details && (
                          <div className="text-xs mt-1">
                            Phone numbers fixed: {result.details.phoneFixed} | 
                            Duplicates removed: {result.details.duplicatesRemoved} | 
                            Emails fixed: {result.details.emailsFixed}
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
                    disabled={cleaning}
                    className={`flex-1 px-4 py-2 text-sm rounded-lg transition-colors ${
                      theme === 'gold'
                        ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                        : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                    } disabled:opacity-50`}
                  >
                    {result?.success ? 'Close' : 'Cancel'}
                  </button>
                  
                  <button
                    onClick={analyzeList}
                    disabled={analyzing || cleaning}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    } disabled:opacity-50`}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Re-analyze
                  </button>

                  {!result?.success && (
                    <button
                      onClick={executeListCleaning}
                      disabled={cleaning || Object.values(selectedCleaningOptions).every(v => !v)}
                      className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        theme === 'gold'
                          ? 'gold-gradient text-black hover-gold'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      } disabled:opacity-50`}
                    >
                      {cleaning ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                          Cleaning...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <Sparkles className="h-4 w-4 mr-2" />
                          Clean List
                        </div>
                      )}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <AlertCircle className={`h-12 w-12 mx-auto mb-4 ${
                  theme === 'gold' ? 'text-red-400' : 'text-red-600'
                }`} />
                <p className={`text-sm ${
                  theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Failed to analyze list data
                </p>
                <button
                  onClick={analyzeList}
                  className={`mt-4 inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    theme === 'gold'
                      ? 'gold-gradient text-black hover-gold'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </button>
              </div>
            )}

            {/* Cleaning Benefits */}
            <div className={`p-4 rounded-lg ${
              theme === 'gold'
                ? 'bg-green-500/10 border border-green-500/20'
                : 'bg-green-50 border border-green-200'
            }`}>
              <h4 className={`text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-green-400' : 'text-green-700'
              }`}>
                ✨ Benefits of List Cleaning
              </h4>
              <ul className={`text-sm space-y-1 ${
                theme === 'gold' ? 'text-green-300' : 'text-green-600'
              }`}>
                <li>• Higher deliverability rates with properly formatted contact info</li>
                <li>• Avoid contacting the same person multiple times</li>
                <li>• Better campaign performance with clean, organized data</li>
                <li>• Reduced bounce rates and improved sender reputation</li>
                <li>• More accurate analytics and reporting</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}