import React, { useState, useEffect } from 'react';
import { 
  Cookie, 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  Globe,
  Eye,
  EyeOff,
  Copy,
  Download,
  RefreshCw
} from 'lucide-react';

interface CookieCaptureHelperProps {
  targetDomain: string;
  requiredCookies: string[];
  onCapture: (data: any) => void;
  onError: (error: string) => void;
}

export function CookieCaptureHelper({ 
  targetDomain, 
  requiredCookies, 
  onCapture, 
  onError 
}: CookieCaptureHelperProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedCookies, setCapturedCookies] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [currentDomain, setCurrentDomain] = useState('');

  useEffect(() => {
    // Check current domain
    setCurrentDomain(window.location.hostname);
  }, []);

  const captureCookies = async () => {
    setIsCapturing(true);
    
    try {
      // Check if we're on the target domain
      if (!window.location.hostname.includes(targetDomain)) {
        throw new Error(`Please navigate to ${targetDomain} first`);
      }

      // Read cookies from current page
      const allCookies: Record<string, string> = {};
      const cookieString = document.cookie;
      
      cookieString.split(';').forEach(cookie => {
        const [key, ...valueParts] = cookie.split('=');
        if (key && valueParts.length > 0) {
          const cleanKey = key.trim();
          const cleanValue = valueParts.join('=').trim();
          if (cleanKey && cleanValue) {
            allCookies[cleanKey] = cleanValue;
          }
        }
      });

      // Filter to only required cookies
      const filteredCookies: Record<string, string> = {};
      requiredCookies.forEach(cookieName => {
        if (allCookies[cookieName]) {
          filteredCookies[cookieName] = allCookies[cookieName];
        }
      });

      setCapturedCookies(filteredCookies);

      // Check if we got all required cookies
      const missingCookies = requiredCookies.filter(name => !filteredCookies[name]);
      if (missingCookies.length > 0) {
        throw new Error(`Missing required cookies: ${missingCookies.join(', ')}. Please make sure you're logged in.`);
      }

      // Prepare capture data
      const captureData = {
        cookies: filteredCookies,
        userAgent: navigator.userAgent,
        domain: window.location.hostname,
        timestamp: new Date().toISOString()
      };

      onCapture(captureData);

    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to capture cookies');
    } finally {
      setIsCapturing(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const exportCookies = () => {
    const cookieData = {
      domain: currentDomain,
      timestamp: new Date().toISOString(),
      cookies: capturedCookies,
      userAgent: navigator.userAgent
    };

    const blob = new Blob([JSON.stringify(cookieData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${targetDomain}-cookies-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-gray-200">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Cookie className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Cookie Capture</h2>
              <p className="text-sm text-gray-600">{targetDomain}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Domain Check */}
          <div className={`p-4 rounded-lg border ${
            currentDomain.includes(targetDomain)
              ? 'border-green-200 bg-green-50'
              : 'border-red-200 bg-red-50'
          }`}>
            <div className="flex items-center space-x-2">
              <Globe className={`h-4 w-4 ${
                currentDomain.includes(targetDomain) ? 'text-green-600' : 'text-red-600'
              }`} />
              <span className={`text-sm font-medium ${
                currentDomain.includes(targetDomain) ? 'text-green-800' : 'text-red-800'
              }`}>
                {currentDomain.includes(targetDomain) 
                  ? `✅ On ${targetDomain}` 
                  : `❌ Navigate to ${targetDomain} first`
                }
              </span>
            </div>
          </div>

          {/* Required Cookies List */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Required Cookies ({requiredCookies.length}):
            </h3>
            <div className="space-y-2">
              {requiredCookies.map(cookieName => {
                const isAvailable = capturedCookies[cookieName];
                return (
                  <div key={cookieName} className={`flex items-center justify-between p-2 rounded border ${
                    isAvailable ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className="flex items-center space-x-2">
                      {isAvailable ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-gray-400" />
                      )}
                      <code className="text-sm font-mono text-gray-900">{cookieName}</code>
                    </div>
                    {isAvailable && (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-600">
                          {showValues[cookieName] 
                            ? capturedCookies[cookieName].substring(0, 20) + '...'
                            : '••••••••••••••••'
                          }
                        </span>
                        <button
                          onClick={() => setShowValues(prev => ({
                            ...prev,
                            [cookieName]: !prev[cookieName]
                          }))}
                          className="p-1 text-gray-500 hover:text-gray-700"
                        >
                          {showValues[cookieName] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Capture Button */}
          <button
            onClick={captureCookies}
            disabled={isCapturing || !currentDomain.includes(targetDomain)}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
              currentDomain.includes(targetDomain)
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            } disabled:opacity-50`}
          >
            {isCapturing ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Capturing Cookies...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <Cookie className="h-4 w-4 mr-2" />
                🍪 Capture Cookies
              </div>
            )}
          </button>

          {/* Export Option */}
          {Object.keys(capturedCookies).length > 0 && (
            <div className="flex space-x-2">
              <button
                onClick={exportCookies}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </button>
              <button
                onClick={() => copyToClipboard(JSON.stringify(capturedCookies, null, 2))}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Data
              </button>
            </div>
          )}

          {/* Instructions */}
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
            <h4 className="text-sm font-medium text-blue-700 mb-2">
              📋 Instructions:
            </h4>
            <ol className="text-sm text-blue-600 space-y-1 list-decimal list-inside">
              <li>Make sure you're logged in to {targetDomain}</li>
              <li>Click "🍪 Capture Cookies" above</li>
              <li>Review the captured data</li>
              <li>The window will close automatically when done</li>
            </ol>
          </div>

          {/* Security Notice */}
          <div className="p-3 rounded-lg bg-green-50 border border-green-200">
            <div className="flex items-center space-x-2">
              <Shield className="h-4 w-4 text-green-600" />
              <span className="text-xs text-green-700">
                Only authentication cookies are captured. No passwords or personal data.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}