import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { X, Save, Plus, Trash2, Download, Upload, Grid, Edit3, CheckCircle, AlertCircle, RefreshCw, Crown, Zap, Copy, Cast as Paste } from 'lucide-react';

interface SpreadsheetEditorProps {
  listId: string;
  listName: string;
  onClose: () => void;
  onSave: () => void;
}

interface EditableLead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company_name: string;
  job_title: string;
  source_url: string;
  source_platform: string;
  isNew?: boolean;
  isModified?: boolean;
  isDeleted?: boolean;
}

export function SpreadsheetEditor({ listId, listName, onClose, onSave }: SpreadsheetEditorProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [leads, setLeads] = useState<EditableLead[]>([]);
  const [originalLeads, setOriginalLeads] = useState<EditableLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; field: string } | null>(null);
  const [copiedData, setCopiedData] = useState<string>('');
  const tableRef = useRef<HTMLDivElement>(null);

  const columns = [
    { key: 'name', label: 'Name', width: '200px' },
    { key: 'email', label: 'Email', width: '250px' },
    { key: 'phone', label: 'Phone', width: '150px' },
    { key: 'company_name', label: 'Company', width: '200px' },
    { key: 'job_title', label: 'Job Title', width: '180px' },
    { key: 'source_url', label: 'Source URL', width: '200px' },
    { key: 'source_platform', label: 'Source', width: '120px' }
  ];

  useEffect(() => {
    if (listId && user) {
      fetchLeads();
    }
  }, [listId, user]);

  const fetchLeads = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('list_leads')
        .select('*')
        .eq('list_id', listId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedLeads = (data || []).map(lead => ({
        id: lead.id,
        name: lead.name || '',
        email: lead.email || '',
        phone: lead.phone || '',
        company_name: lead.company_name || '',
        job_title: lead.job_title || '',
        source_url: lead.source_url || '',
        source_platform: lead.source_platform || '',
        isNew: false,
        isModified: false,
        isDeleted: false
      }));

      setLeads(formattedLeads);
      setOriginalLeads(JSON.parse(JSON.stringify(formattedLeads)));
    } catch (error) {
      console.error('Error fetching leads:', error);
      setResult({ success: false, message: 'Failed to load leads' });
    } finally {
      setLoading(false);
    }
  };

  const addNewRow = () => {
    const newLead: EditableLead = {
      id: `new_${Date.now()}`,
      name: '',
      email: '',
      phone: '',
      company_name: '',
      job_title: '',
      source_url: '',
      source_platform: 'manual',
      isNew: true,
      isModified: false,
      isDeleted: false
    };
    setLeads([...leads, newLead]);
  };

  const deleteRow = (index: number) => {
    const newLeads = [...leads];
    if (newLeads[index].isNew) {
      // Remove new rows completely
      newLeads.splice(index, 1);
    } else {
      // Mark existing rows as deleted
      newLeads[index].isDeleted = true;
    }
    setLeads(newLeads);
  };

  const updateCell = (rowIndex: number, field: string, value: string) => {
    const newLeads = [...leads];
    const lead = newLeads[rowIndex];
    
    if (lead) {
      (lead as any)[field] = value;
      
      // Mark as modified if not new
      if (!lead.isNew) {
        const original = originalLeads.find(o => o.id === lead.id);
        if (original && (original as any)[field] !== value) {
          lead.isModified = true;
        }
      }
      
      setLeads(newLeads);
    }
  };

  const handleCellClick = (rowIndex: number, field: string) => {
    setEditingCell({ rowIndex, field });
  };

  const handleCellKeyDown = (e: React.KeyboardEvent, rowIndex: number, field: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setEditingCell(null);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const currentColIndex = columns.findIndex(col => col.key === field);
      const nextColIndex = e.shiftKey ? currentColIndex - 1 : currentColIndex + 1;
      
      if (nextColIndex >= 0 && nextColIndex < columns.length) {
        setEditingCell({ rowIndex, field: columns[nextColIndex].key });
      } else if (!e.shiftKey && nextColIndex >= columns.length) {
        // Move to next row, first column
        if (rowIndex + 1 < leads.length) {
          setEditingCell({ rowIndex: rowIndex + 1, field: columns[0].key });
        }
      } else if (e.shiftKey && nextColIndex < 0) {
        // Move to previous row, last column
        if (rowIndex > 0) {
          setEditingCell({ rowIndex: rowIndex - 1, field: columns[columns.length - 1].key });
        }
      }
    }
  };

  const copySelectedCells = () => {
    // Simple copy functionality - could be enhanced
    const selectedData = leads
      .filter((_, index) => selectedCells.has(`${index}`))
      .map(lead => columns.map(col => (lead as any)[col.key] || '').join('\t'))
      .join('\n');
    
    setCopiedData(selectedData);
    navigator.clipboard.writeText(selectedData);
  };

  const pasteData = async () => {
    try {
      const clipboardData = await navigator.clipboard.readText();
      // Basic paste functionality - could be enhanced for multi-cell paste
      console.log('Pasted data:', clipboardData);
    } catch (error) {
      console.error('Failed to paste:', error);
    }
  };

  const saveChanges = async () => {
    if (!user) return;

    setSaving(true);
    setResult(null);

    try {
      const changes = {
        toInsert: leads.filter(lead => lead.isNew && !lead.isDeleted),
        toUpdate: leads.filter(lead => lead.isModified && !lead.isNew && !lead.isDeleted),
        toDelete: leads.filter(lead => lead.isDeleted && !lead.isNew)
      };

      let insertedCount = 0;
      let updatedCount = 0;
      let deletedCount = 0;

      // Insert new leads
      if (changes.toInsert.length > 0) {
        const leadsToInsert = changes.toInsert.map(lead => ({
          list_id: listId,
          user_id: user.id,
          name: lead.name || 'Unnamed Lead',
          email: lead.email || null,
          phone: lead.phone || null,
          company_name: lead.company_name || null,
          job_title: lead.job_title || null,
          source_url: lead.source_url || null,
          source_platform: lead.source_platform || 'manual',
          custom_fields: {}
        }));

        const { error: insertError } = await supabase
          .from('list_leads')
          .insert(leadsToInsert);

        if (insertError) throw insertError;
        insertedCount = leadsToInsert.length;
      }

      // Update modified leads
      for (const lead of changes.toUpdate) {
        const { error: updateError } = await supabase
          .from('list_leads')
          .update({
            name: lead.name || 'Unnamed Lead',
            email: lead.email || null,
            phone: lead.phone || null,
            company_name: lead.company_name || null,
            job_title: lead.job_title || null,
            source_url: lead.source_url || null,
            source_platform: lead.source_platform || 'manual',
            updated_at: new Date().toISOString()
          })
          .eq('id', lead.id)
          .eq('user_id', user.id);

        if (updateError) throw updateError;
        updatedCount++;
      }

      // Delete marked leads
      if (changes.toDelete.length > 0) {
        const idsToDelete = changes.toDelete.map(lead => lead.id);
        const { error: deleteError } = await supabase
          .from('list_leads')
          .delete()
          .in('id', idsToDelete)
          .eq('user_id', user.id);

        if (deleteError) throw deleteError;
        deletedCount = idsToDelete.length;
      }

      setResult({
        success: true,
        message: `Changes saved! ${insertedCount} added, ${updatedCount} updated, ${deletedCount} deleted.`
      });

      // Refresh data
      setTimeout(() => {
        fetchLeads();
        onSave();
      }, 1500);

    } catch (error) {
      console.error('Error saving changes:', error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save changes'
      });
    } finally {
      setSaving(false);
    }
  };

  const exportToCSV = () => {
    const csvContent = [
      columns.map(col => col.label),
      ...leads.filter(lead => !lead.isDeleted).map(lead => 
        columns.map(col => (lead as any)[col.key] || '')
      )
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${listName}_edited_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasChanges = leads.some(lead => lead.isNew || lead.isModified || lead.isDeleted);
  const visibleLeads = leads.filter(lead => !lead.isDeleted);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" message="Loading spreadsheet editor..." />
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-50 overflow-hidden ${
      theme === 'gold' ? 'bg-black/75' : 'bg-gray-900/50'
    }`}>
      <div className={`h-full flex flex-col ${
        theme === 'gold' ? 'black-card' : 'bg-white'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
        }`}>
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              theme === 'gold' ? 'gold-gradient' : 'bg-blue-100'
            }`}>
              <Grid className={`h-6 w-6 ${
                theme === 'gold' ? 'text-black' : 'text-blue-600'
              }`} />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${
                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
              }`}>
                Edit List: {listName}
              </h2>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Spreadsheet-like editor for your lead list ({visibleLeads.length} leads)
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={exportToCSV}
              className={`inline-flex items-center px-3 py-2 text-sm rounded-lg border transition-colors ${
                theme === 'gold'
                  ? 'border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </button>
            
            <button
              onClick={saveChanges}
              disabled={saving || !hasChanges}
              className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                theme === 'gold'
                  ? 'gold-gradient text-black hover-gold'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-50`}
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}
            </button>
            
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

        {/* Toolbar */}
        <div className={`flex items-center justify-between p-4 border-b ${
          theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
        }`}>
          <div className="flex items-center space-x-3">
            <button
              onClick={addNewRow}
              className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                theme === 'gold'
                  ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Row
            </button>
            
            <button
              onClick={copySelectedCells}
              disabled={selectedCells.size === 0}
              className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                theme === 'gold'
                  ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              } disabled:opacity-50`}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </button>
            
            <button
              onClick={pasteData}
              className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                theme === 'gold'
                  ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Paste className="h-4 w-4 mr-1" />
              Paste
            </button>
          </div>

          <div className="flex items-center space-x-2 text-sm">
            {hasChanges && (
              <span className={`px-2 py-1 rounded-full text-xs ${
                theme === 'gold'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                Unsaved changes
              </span>
            )}
            <span className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
              {visibleLeads.length} rows
            </span>
          </div>
        </div>

        {/* Result Message */}
        {result && (
          <div className={`mx-6 mt-4 rounded-lg border p-4 ${
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
              <button
                onClick={() => setResult(null)}
                className="ml-auto text-current hover:opacity-70"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Spreadsheet */}
        <div className="flex-1 overflow-auto p-6">
          <div 
            ref={tableRef}
            className={`border rounded-lg overflow-hidden ${
              theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
            }`}
          >
            <table className="min-w-full">
              {/* Header */}
              <thead className={`sticky top-0 ${
                theme === 'gold' ? 'bg-black/40' : 'bg-gray-50'
              }`}>
                <tr>
                  <th className={`w-12 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    #
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      style={{ width: column.width }}
                      className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                        theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                      }`}
                    >
                      {column.label}
                    </th>
                  ))}
                  <th className={`w-16 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Actions
                  </th>
                </tr>
              </thead>

              {/* Body */}
              <tbody className={`divide-y ${
                theme === 'gold' ? 'divide-yellow-400/20' : 'divide-gray-200'
              }`}>
                {visibleLeads.map((lead, rowIndex) => (
                  <tr
                    key={lead.id}
                    className={`transition-colors ${
                      lead.isNew
                        ? theme === 'gold' ? 'bg-green-500/10' : 'bg-green-50'
                        : lead.isModified
                        ? theme === 'gold' ? 'bg-yellow-500/10' : 'bg-yellow-50'
                        : theme === 'gold' ? 'hover:bg-yellow-400/5' : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* Row Number */}
                    <td className={`px-4 py-2 text-xs ${
                      theme === 'gold' ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      {rowIndex + 1}
                      {lead.isNew && (
                        <span className={`ml-1 text-xs ${
                          theme === 'gold' ? 'text-green-400' : 'text-green-600'
                        }`}>
                          NEW
                        </span>
                      )}
                      {lead.isModified && (
                        <span className={`ml-1 text-xs ${
                          theme === 'gold' ? 'text-yellow-400' : 'text-yellow-600'
                        }`}>
                          MOD
                        </span>
                      )}
                    </td>

                    {/* Data Cells */}
                    {columns.map((column) => {
                      const cellKey = `${rowIndex}-${column.key}`;
                      const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.field === column.key;
                      const cellValue = (lead as any)[column.key] || '';

                      return (
                        <td
                          key={column.key}
                          className={`px-4 py-2 border-r ${
                            theme === 'gold' ? 'border-yellow-400/10' : 'border-gray-100'
                          }`}
                          style={{ width: column.width }}
                        >
                          {isEditing ? (
                            <input
                              type="text"
                              value={cellValue}
                              onChange={(e) => updateCell(rowIndex, column.key, e.target.value)}
                              onBlur={() => setEditingCell(null)}
                              onKeyDown={(e) => handleCellKeyDown(e, rowIndex, column.key)}
                              className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 ${
                                theme === 'gold'
                                  ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                                  : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                              }`}
                              autoFocus
                            />
                          ) : (
                            <div
                              onClick={() => handleCellClick(rowIndex, column.key)}
                              className={`min-h-[24px] px-2 py-1 text-sm cursor-text rounded hover:bg-opacity-50 ${
                                selectedCells.has(cellKey)
                                  ? theme === 'gold' ? 'bg-yellow-400/20' : 'bg-blue-100'
                                  : 'hover:bg-gray-100'
                              } ${
                                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                              }`}
                            >
                              {cellValue || (
                                <span className={theme === 'gold' ? 'text-gray-600' : 'text-gray-400'}>
                                  Click to edit
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Actions */}
                    <td className="px-4 py-2">
                      <button
                        onClick={() => deleteRow(rowIndex)}
                        className={`p-1 rounded transition-colors ${
                          theme === 'gold'
                            ? 'text-red-400 hover:bg-red-400/10'
                            : 'text-red-600 hover:bg-red-50'
                        }`}
                        title="Delete row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className={`p-4 border-t ${
          theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className={`text-sm ${
              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              💡 Tips: Click cells to edit • Tab to navigate • Enter to confirm • Escape to cancel
            </div>
            
            <div className="flex items-center space-x-2">
              <span className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {leads.filter(l => l.isNew).length} new • {leads.filter(l => l.isModified).length} modified • {leads.filter(l => l.isDeleted).length} deleted
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}