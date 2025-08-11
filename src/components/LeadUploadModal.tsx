import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { SecurityManager } from '../utils/security';
import { InputValidator } from '../utils/validation';
import Papa from 'papaparse';
import { 
  X, 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Download,
  Users,
  Crown,
  Zap
} from 'lucide-react';

interface LeadUploadModalProps {
  listId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedLead {
  name: string;
  email: string;
  phone: string;
  company_name: string;
  job_title: string;
  source_url: string;
  source_platform: string;
}

export function LeadUploadModal({ listId, onClose, onSuccess }: LeadUploadModalProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [uploadMethod, setUploadMethod] = useState<'csv' | 'manual'>('csv');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
  const [manualLead, setManualLead] = useState({
    name: '',
    email: '',
    phone: '',
    company_name: '',
    job_title: '',
    source_url: '',
    source_platform: 'manual'
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        setResult({ success: false, message: 'Please upload a CSV file' });
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const processCSVUpload = async () => {
    if (!file || !user) return;

    setUploading(true);
    setResult(null);

    try {
      const text = await file.text();
      
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const leads: ParsedLead[] = [];
            const errors: string[] = [];

            results.data.forEach((row: any, index: number) => {
              try {
                // Map CSV columns to lead fields (flexible mapping)
                const lead: ParsedLead = {
                  name: row.name || row.Name || row.full_name || row['Full Name'] || '',
                  email: row.email || row.Email || row.email_address || row['Email Address'] || '',
                  phone: row.phone || row.Phone || row.phone_number || row['Phone Number'] || '',
                  company_name: row.company || row.Company || row.company_name || row['Company Name'] || '',
                  job_title: row.title || row.Title || row.job_title || row['Job Title'] || row.position || row.Position || '',
                  source_url: row.source_url || row['Source URL'] || row.linkedin || row.LinkedIn || '',
                  source_platform: row.source || row.Source || row.platform || row.Platform || 'csv_upload'
                };

                // Validate required fields
                if (!lead.name.trim()) {
                  errors.push(`Row ${index + 2}: Name is required`);
                  return;
                }

                // Validate email if provided
                if (lead.email && !InputValidator.validateEmail(lead.email).isValid) {
                  errors.push(`Row ${index + 2}: Invalid email format`);
                  return;
                }

                // Validate phone if provided
                if (lead.phone && !InputValidator.validatePhone(lead.phone).isValid) {
                  errors.push(`Row ${index + 2}: Invalid phone format`);
                  return;
                }

                leads.push(lead);
              } catch (error) {
                errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : 'Processing error'}`);
              }
            });

            if (errors.length > 0 && leads.length === 0) {
              setResult({ 
                success: false, 
                message: `CSV processing failed: ${errors.slice(0, 5).join(', ')}${errors.length > 5 ? '...' : ''}` 
              });
              setUploading(false);
              return;
            }

            // Import leads to list
            await importLeadsToList(leads);

            if (errors.length > 0) {
              setResult({
                success: true,
                message: `Imported ${leads.length} leads successfully. ${errors.length} rows had errors.`,
                details: { imported: leads.length, errors: errors.length }
              });
            } else {
              setResult({
                success: true,
                message: `Successfully imported ${leads.length} leads to the list!`,
                details: { imported: leads.length, errors: 0 }
              });
            }

          } catch (error) {
            setResult({
              success: false,
              message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
          } finally {
            setUploading(false);
          }
        },
        error: (error) => {
          setResult({ success: false, message: `CSV parsing failed: ${error.message}` });
          setUploading(false);
        }
      });

    } catch (error) {
      setResult({
        success: false,
        message: `File processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      setUploading(false);
    }
  };

  const importLeadsToList = async (leads: ParsedLead[]) => {
    if (!user) return;

    const leadsToInsert = leads.map(lead => ({
      list_id: listId,
      user_id: user.id,
      name: SecurityManager.sanitizeInput(lead.name),
      email: lead.email ? SecurityManager.sanitizeEmail(lead.email) : null,
      phone: lead.phone ? SecurityManager.sanitizePhone(lead.phone) : null,
      company_name: lead.company_name ? SecurityManager.sanitizeInput(lead.company_name) : null,
      job_title: lead.job_title ? SecurityManager.sanitizeInput(lead.job_title) : null,
      source_url: lead.source_url ? SecurityManager.sanitizeUrl(lead.source_url) : null,
      source_platform: SecurityManager.sanitizeInput(lead.source_platform),
      custom_fields: {}
    }));

    // Insert in batches to avoid timeout
    const batchSize = 50;
    for (let i = 0; i < leadsToInsert.length; i += batchSize) {
      const batch = leadsToInsert.slice(i, i + batchSize);
      const { error } = await supabase
        .from('list_leads')
        .insert(batch);

      if (error) {
        throw new Error(`Batch ${Math.floor(i/batchSize) + 1} failed: ${error.message}`);
      }
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validate manual lead
    if (!manualLead.name.trim()) {
      setResult({ success: false, message: 'Name is required' });
      return;
    }

    if (manualLead.email && !InputValidator.validateEmail(manualLead.email).isValid) {
      setResult({ success: false, message: 'Invalid email format' });
      return;
    }

    if (manualLead.phone && !InputValidator.validatePhone(manualLead.phone).isValid) {
      setResult({ success: false, message: 'Invalid phone format' });
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      await importLeadsToList([manualLead]);
      setResult({ success: true, message: 'Lead added successfully!' });
      
      // Reset form
      setManualLead({
        name: '',
        email: '',
        phone: '',
        company_name: '',
        job_title: '',
        source_url: '',
        source_platform: 'manual'
      });

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);

    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add lead'
      });
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = [
      ['name', 'email', 'phone', 'company_name', 'job_title', 'source_url', 'source_platform'],
      ['John Doe', 'john@company.com', '+1234567890', 'Acme Corp', 'Marketing Director', 'https://linkedin.com/in/johndoe', 'linkedin'],
      ['Jane Smith', 'jane@startup.com', '+1987654321', 'Startup Inc', 'CEO', 'https://company.com/about', 'website']
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads_template.csv';
    a.click();
    URL.revokeObjectURL(url);
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
                  <Upload className={`h-6 w-6 ${
                    theme === 'gold' ? 'text-black' : 'text-blue-600'
                  }`} />
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    Upload Leads to List
                  </h2>
                  <p className={`text-sm ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Add leads via CSV upload or manual entry
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
            {/* Upload Method Selection */}
            <div>
              <label className={`block text-sm font-medium mb-3 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Upload Method
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setUploadMethod('csv')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    uploadMethod === 'csv'
                      ? theme === 'gold'
                        ? 'border-yellow-400 bg-yellow-400/10'
                        : 'border-blue-500 bg-blue-50'
                      : theme === 'gold'
                        ? 'border-gray-600 hover:border-gray-500'
                        : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-2">
                    <FileText className={`h-6 w-6 ${
                      uploadMethod === 'csv'
                        ? theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                        : theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                    }`} />
                    <span className={`text-sm font-medium ${
                      uploadMethod === 'csv'
                        ? theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                        : theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      CSV Upload
                    </span>
                    <span className={`text-xs text-center ${
                      theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                    }`}>
                      Bulk import from file
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => setUploadMethod('manual')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    uploadMethod === 'manual'
                      ? theme === 'gold'
                        ? 'border-yellow-400 bg-yellow-400/10'
                        : 'border-blue-500 bg-blue-50'
                      : theme === 'gold'
                        ? 'border-gray-600 hover:border-gray-500'
                        : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-2">
                    <Users className={`h-6 w-6 ${
                      uploadMethod === 'manual'
                        ? theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                        : theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                    }`} />
                    <span className={`text-sm font-medium ${
                      uploadMethod === 'manual'
                        ? theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                        : theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Manual Entry
                    </span>
                    <span className={`text-xs text-center ${
                      theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                    }`}>
                      Add one lead
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* CSV Upload */}
            {uploadMethod === 'csv' && (
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    CSV File
                  </label>
                  <div className={`border-2 border-dashed rounded-lg p-6 text-center ${
                    theme === 'gold'
                      ? 'border-yellow-400/30 bg-yellow-400/5'
                      : 'border-gray-300 bg-gray-50'
                  }`}>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="csv-upload"
                    />
                    <label htmlFor="csv-upload" className="cursor-pointer">
                      <Upload className={`h-8 w-8 mx-auto mb-2 ${
                        theme === 'gold' ? 'text-yellow-400' : 'text-gray-400'
                      }`} />
                      <p className={`text-sm font-medium ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        {file ? file.name : 'Click to upload CSV file'}
                      </p>
                      <p className={`text-xs ${
                        theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                      }`}>
                        Supports: name, email, phone, company, job_title columns
                      </p>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    onClick={downloadTemplate}
                    className={`inline-flex items-center px-3 py-2 text-sm rounded-lg border transition-colors ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Template
                  </button>

                  <button
                    onClick={processCSVUpload}
                    disabled={!file || uploading}
                    className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      theme === 'gold'
                        ? 'gold-gradient text-black hover-gold'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    } disabled:opacity-50`}
                  >
                    {uploading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {uploading ? 'Processing...' : 'Upload CSV'}
                  </button>
                </div>
              </div>
            )}

            {/* Manual Entry */}
            {uploadMethod === 'manual' && (
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={manualLead.name}
                      onChange={(e) => setManualLead({ ...manualLead, name: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        theme === 'gold'
                          ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                          : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                      }`}
                      placeholder="John Doe"
                      required
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={manualLead.email}
                      onChange={(e) => setManualLead({ ...manualLead, email: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        theme === 'gold'
                          ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                          : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                      }`}
                      placeholder="john@company.com"
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={manualLead.phone}
                      onChange={(e) => setManualLead({ ...manualLead, phone: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        theme === 'gold'
                          ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                          : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                      }`}
                      placeholder="+1234567890"
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={manualLead.company_name}
                      onChange={(e) => setManualLead({ ...manualLead, company_name: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        theme === 'gold'
                          ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                          : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                      }`}
                      placeholder="Acme Corp"
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Job Title
                    </label>
                    <input
                      type="text"
                      value={manualLead.job_title}
                      onChange={(e) => setManualLead({ ...manualLead, job_title: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        theme === 'gold'
                          ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                          : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                      }`}
                      placeholder="Marketing Director"
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Source URL
                    </label>
                    <input
                      type="url"
                      value={manualLead.source_url}
                      onChange={(e) => setManualLead({ ...manualLead, source_url: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        theme === 'gold'
                          ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                          : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                      }`}
                      placeholder="https://linkedin.com/in/johndoe"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={uploading}
                  className={`w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    theme === 'gold'
                      ? 'gold-gradient text-black hover-gold'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  } disabled:opacity-50`}
                >
                  {uploading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Adding Lead...
                    </div>
                  ) : (
                    'Add Lead to List'
                  )}
                </button>
              </form>
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
                      <p className="text-xs mt-1">
                        Imported: {result.details.imported} | Errors: {result.details.errors}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* CSV Format Guide */}
            {uploadMethod === 'csv' && (
              <div className={`p-4 rounded-lg ${
                theme === 'gold'
                  ? 'bg-blue-500/10 border border-blue-500/20'
                  : 'bg-blue-50 border border-blue-200'
              }`}>
                <h4 className={`text-sm font-medium mb-2 ${
                  theme === 'gold' ? 'text-blue-400' : 'text-blue-700'
                }`}>
                  📋 CSV Format Requirements
                </h4>
                <ul className={`text-sm space-y-1 ${
                  theme === 'gold' ? 'text-blue-300' : 'text-blue-600'
                }`}>
                  <li>• <strong>Required:</strong> name column</li>
                  <li>• <strong>Optional:</strong> email, phone, company_name, job_title, source_url</li>
                  <li>• Column names are flexible (e.g., "Name", "Full Name", "name" all work)</li>
                  <li>• Phone numbers should include country code (e.g., +1234567890)</li>
                  <li>• Email addresses must be valid format</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}