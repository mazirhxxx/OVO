import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { 
  X, 
  Sparkles, 
  CheckCircle, 
  AlertCircle, 
  Users,
  DollarSign,
  Target,
  Crown,
  Zap,
  Play,
  Clock
} from 'lucide-react';

interface EnrichmentModalProps {
  listId: string;
  leadCount: number;
  onClose: () => void;
  onSuccess: () => void;
}

interface EnrichmentJob {
  id: string;
  status: string;
  leads_processed: number;
  leads_enriched: number;
  cost_usd: number;
}

export function EnrichmentModal({ listId, leadCount, onClose, onSuccess }: EnrichmentModalProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [enrichmentType, setEnrichmentType] = useState<'basic' | 'premium'>('basic');
  const [enriching, setEnriching] = useState(false);
  const [enrichmentJob, setEnrichmentJob] = useState<EnrichmentJob | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const enrichmentOptions = {
    basic: {
      name: 'Basic Enrichment',
      description: 'Add missing email addresses and company information',
      features: ['Email discovery', 'Company details', 'Job title verification'],
      costPerLead: 0.05,
      estimatedTime: '2-5 minutes'
    },
    premium: {
      name: 'Premium Enrichment',
      description: 'Complete profile enrichment with intent signals',
      features: ['Everything in Basic', 'Phone numbers', 'Social profiles', 'Intent scoring', 'Company technographics'],
      costPerLead: 0.15,
      estimatedTime: '5-10 minutes'
    }
  };

  const startEnrichment = async () => {
    if (!user) return;

    setEnriching(true);
    setResult(null);

    try {
      // Call n8n enrichment webhook
      const response = await fetch('https://mazirhx.app.n8n.cloud/webhook/enrich-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          list_id: listId,
          enrichment_type: enrichmentType,
          lead_count: leadCount,
          estimated_cost: (leadCount * enrichmentOptions[enrichmentType].costPerLead).toFixed(2)
        }),
      });

      if (response.ok) {
        const jobData = await response.json();
        setEnrichmentJob(jobData);
        
        setResult({
          success: true,
          message: `Enrichment started! Processing ${leadCount} leads with ${enrichmentType} enrichment. You'll be notified when complete.`
        });

        // Poll for completion
        pollEnrichmentStatus(jobData.job_id);
      } else {
        throw new Error('Failed to start enrichment');
      }

    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to start enrichment'
      });
      setEnriching(false);
    }
  };

  const pollEnrichmentStatus = async (jobId: string) => {
    const maxAttempts = 60; // 10 minutes max
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`https://mazirhx.app.n8n.cloud/webhook/enrichment-status/${jobId}`);
        
        if (response.ok) {
          const status = await response.json();
          setEnrichmentJob(status);

          if (status.status === 'completed') {
            setEnriching(false);
            setResult({
              success: true,
              message: `Enrichment completed! ${status.leads_enriched} leads enriched. Cost: $${status.cost_usd.toFixed(2)}`
            });
            
            setTimeout(() => {
              onSuccess();
              onClose();
            }, 2000);
            return;
          }

          if (status.status === 'failed') {
            setEnriching(false);
            setResult({
              success: false,
              message: `Enrichment failed: ${status.error_message || 'Unknown error'}`
            });
            return;
          }

          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(poll, 10000); // Poll every 10 seconds
          } else {
            setEnriching(false);
            setResult({
              success: false,
              message: 'Enrichment timed out. Please check the status later.'
            });
          }
        }
      } catch (error) {
        console.error('Error polling enrichment status:', error);
        setEnriching(false);
      }
    };

    poll();
  };

  const estimatedCost = leadCount * enrichmentOptions[enrichmentType].costPerLead;

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
                  <Sparkles className={`h-6 w-6 ${
                    theme === 'gold' ? 'text-black' : 'text-blue-600'
                  }`} />
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    Enrich Lead List
                  </h2>
                  <p className={`text-sm ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Add missing contact info and intent signals to {leadCount} leads
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
            {/* Enrichment Type Selection */}
            <div>
              <label className={`block text-sm font-medium mb-3 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Enrichment Level
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(enrichmentOptions).map(([key, option]) => (
                  <button
                    key={key}
                    onClick={() => setEnrichmentType(key as any)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      enrichmentType === key
                        ? theme === 'gold'
                          ? 'border-yellow-400 bg-yellow-400/10'
                          : 'border-blue-500 bg-blue-50'
                        : theme === 'gold'
                          ? 'border-gray-600 hover:border-gray-500'
                          : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className={`font-semibold ${
                        enrichmentType === key
                          ? theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                          : theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        {option.name}
                      </h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        key === 'premium'
                          ? theme === 'gold' ? 'bg-yellow-400/20 text-yellow-400' : 'bg-blue-100 text-blue-700'
                          : theme === 'gold' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                      }`}>
                        ${option.costPerLead}/lead
                      </span>
                    </div>
                    <p className={`text-sm mb-3 ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {option.description}
                    </p>
                    <ul className={`text-xs space-y-1 ${
                      theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                    }`}>
                      {option.features.map((feature, index) => (
                        <li key={index} className="flex items-center">
                          <CheckCircle className="h-3 w-3 mr-2 text-green-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>
            </div>

            {/* Cost Estimate */}
            <div className={`p-4 rounded-lg border ${
              theme === 'gold'
                ? 'border-yellow-400/20 bg-yellow-400/5'
                : 'border-blue-200 bg-blue-50'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-sm font-medium ${
                    theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
                  }`}>
                    Enrichment Summary
                  </div>
                  <div className={`text-xs ${
                    theme === 'gold' ? 'text-yellow-300' : 'text-blue-600'
                  }`}>
                    {leadCount} leads × ${enrichmentOptions[enrichmentType].costPerLead}/lead
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${
                    theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                  }`}>
                    ${estimatedCost.toFixed(2)}
                  </div>
                  <div className={`text-xs ${
                    theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                  }`}>
                    Est. {enrichmentOptions[enrichmentType].estimatedTime}
                  </div>
                </div>
              </div>
            </div>

            {/* Enrichment Progress */}
            {enrichmentJob && enriching && (
              <div className={`p-4 rounded-lg border ${
                theme === 'gold'
                  ? 'border-blue-500/30 bg-blue-500/10'
                  : 'border-blue-200 bg-blue-50'
              }`}>
                <div className="flex items-center space-x-3 mb-3">
                  <div className={`animate-spin rounded-full h-5 w-5 border-2 border-transparent ${
                    theme === 'gold' ? 'border-t-yellow-400' : 'border-t-blue-600'
                  }`}></div>
                  <div>
                    <div className={`text-sm font-medium ${
                      theme === 'gold' ? 'text-blue-400' : 'text-blue-700'
                    }`}>
                      Enriching leads...
                    </div>
                    <div className={`text-xs ${
                      theme === 'gold' ? 'text-blue-300' : 'text-blue-600'
                    }`}>
                      {enrichmentJob.leads_processed || 0} of {leadCount} processed
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
                      width: `${leadCount > 0 ? ((enrichmentJob.leads_processed || 0) / leadCount) * 100 : 0}%`
                    }}
                  />
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
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={enriching}
                className={`flex-1 px-4 py-2 text-sm rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                    : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                } disabled:opacity-50`}
              >
                Cancel
              </button>
              <button
                onClick={startEnrichment}
                disabled={enriching || leadCount === 0}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'gold-gradient text-black hover-gold'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } disabled:opacity-50`}
              >
                {enriching ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    Enriching...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Start Enrichment (${estimatedCost.toFixed(2)})
                  </div>
                )}
              </button>
            </div>

            {/* What Gets Enriched */}
            <div className={`p-4 rounded-lg ${
              theme === 'gold'
                ? 'bg-green-500/10 border border-green-500/20'
                : 'bg-green-50 border border-green-200'
            }`}>
              <h4 className={`text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-green-400' : 'text-green-700'
              }`}>
                🔍 What Gets Enriched
              </h4>
              <ul className={`text-sm space-y-1 ${
                theme === 'gold' ? 'text-green-300' : 'text-green-600'
              }`}>
                <li>• Missing email addresses discovered via multiple sources</li>
                <li>• Company information and employee count</li>
                <li>• Job title verification and seniority level</li>
                {enrichmentType === 'premium' && (
                  <>
                    <li>• Phone numbers from professional directories</li>
                    <li>• Social media profiles (LinkedIn, Twitter)</li>
                    <li>• Intent scoring based on recent activity</li>
                    <li>• Company technology stack and tools used</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}