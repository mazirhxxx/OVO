import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { 
  X, 
  Sparkles, 
  CheckCircle, 
  AlertCircle, 
  Eye,
  EyeOff,
  Globe,
  Shield,
  Cookie,
  Key,
  ExternalLink,
  Play,
  Pause,
  RefreshCw,
  Save,
  Crown,
  Zap,
  Lock,
  Unlock
} from 'lucide-react';

interface AutoCaptureFlowProps {
  actor: any;
  onClose: () => void;
  onSuccess: () => void;
}

interface CapturedData {
  cookies: Record<string, string>;
  userAgent: string;
  domain: string;
  timestamp: string;
}

interface ConsentData {
  cookieNames: string[];
  domain: string;
  purpose: string;
}

export function AutoCaptureFlow({ actor, onClose, onSuccess }: AutoCaptureFlowProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState<'consent' | 'capture' | 'preview' | 'save'>('consent');
  const [helperWindow, setHelperWindow] = useState<Window | null>(null);
  const [capturedData, setCapturedData] = useState<CapturedData | null>(null);
  const [showPreview, setShowPreview] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  // Get required cookie names from actor registry
  const requiredCookies = actor.fields
    .filter((field: any) => field.type === 'password' && field.key !== 'userAgent')
    .map((field: any) => field.key);

  const consentData: ConsentData = {
    cookieNames: requiredCookies,
    domain: actor.targetDomain,
    purpose: `Authenticate your ${actor.title} account for lead discovery`
  };

  useEffect(() => {
    // Listen for messages from helper window
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'cookies_captured') {
        setCapturedData(event.data.data);
        setCurrentStep('preview');
        setIsListening(false);
        if (helperWindow) {
          helperWindow.close();
          setHelperWindow(null);
        }
      } else if (event.data.type === 'capture_error') {
        setError(event.data.error);
        setIsListening(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [helperWindow]);

  const handleStartCapture = () => {
    setCurrentStep('capture');
    setError(null);
    setIsListening(true);

    // Open helper window
    const targetUrl = `https://${actor.targetDomain}`;
    const popup = window.open(
      targetUrl,
      'cookie-capture-helper',
      'width=800,height=600,scrollbars=yes,resizable=yes,toolbar=no,menubar=no'
    );

    if (!popup) {
      setError('Popup blocked. Please allow popups for this site.');
      setIsListening(false);
      return;
    }

    setHelperWindow(popup);

    // Inject capture script after window loads
    const checkLoaded = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(checkLoaded);
          setIsListening(false);
          setCurrentStep('consent');
          return;
        }

        // Check if we can access the popup (same-origin policy)
        if (popup.location.hostname === actor.targetDomain) {
          clearInterval(checkLoaded);
          injectCaptureScript(popup);
        }
      } catch (e) {
        // Cross-origin access blocked - this is expected
        // We'll use a different approach
      }
    }, 1000);

    // Fallback: Show instructions to user
    setTimeout(() => {
      if (popup && !popup.closed) {
        showCaptureInstructions(popup);
      }
    }, 3000);
  };

  const injectCaptureScript = (popup: Window) => {
    try {
      // Create capture interface
      const captureScript = `
        // Create capture overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = \`
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          z-index: 999999;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        \`;

        const captureBox = document.createElement('div');
        captureBox.style.cssText = \`
          background: white;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          text-align: center;
          max-width: 400px;
          margin: 20px;
        \`;

        captureBox.innerHTML = \`
          <div style="margin-bottom: 20px;">
            <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
              <span style="color: white; font-size: 24px;">🍪</span>
            </div>
            <h2 style="margin: 0 0 10px; color: #333; font-size: 18px; font-weight: 600;">Ready to Capture</h2>
            <p style="margin: 0 0 20px; color: #666; font-size: 14px;">Make sure you're logged in, then click capture to securely read your authentication cookies.</p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
              <h4 style="margin: 0 0 8px; color: #495057; font-size: 12px; font-weight: 600; text-transform: uppercase;">Will capture these cookies:</h4>
              <div style="font-family: monospace; font-size: 11px; color: #6c757d;">
                ${requiredCookies.join(', ')}
              </div>
            </div>
          </div>

          <button id="captureBtn" style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            margin-right: 10px;
            transition: transform 0.2s;
          " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            🍪 Capture Cookies
          </button>
          
          <button id="cancelBtn" style="
            background: #6c757d;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
          ">
            Cancel
          </button>
        \`;

        overlay.appendChild(captureBox);
        document.body.appendChild(overlay);

        // Handle capture button click
        document.getElementById('captureBtn').onclick = () => {
          try {
            const cookies = {};
            const cookieString = document.cookie;
            
            // Parse cookies
            cookieString.split(';').forEach(cookie => {
              const [key, ...valueParts] = cookie.split('=');
              if (key && valueParts.length > 0) {
                const cleanKey = key.trim();
                const cleanValue = valueParts.join('=').trim();
                if (cleanKey && cleanValue) {
                  cookies[cleanKey] = cleanValue;
                }
              }
            });

            // Filter to only required cookies
            const filteredCookies = {};
            ${JSON.stringify(requiredCookies)}.forEach(cookieName => {
              if (cookies[cookieName]) {
                filteredCookies[cookieName] = cookies[cookieName];
              }
            });

            // Send captured data back to parent
            window.opener.postMessage({
              type: 'cookies_captured',
              data: {
                cookies: filteredCookies,
                userAgent: navigator.userAgent,
                domain: window.location.hostname,
                timestamp: new Date().toISOString()
              }
            }, '*');

          } catch (error) {
            window.opener.postMessage({
              type: 'capture_error',
              error: 'Failed to capture cookies: ' + error.message
            }, '*');
          }
        };

        // Handle cancel button
        document.getElementById('cancelBtn').onclick = () => {
          window.close();
        };
      `;

      // Execute the script in the popup
      popup.eval(captureScript);
    } catch (error) {
      console.error('Failed to inject capture script:', error);
      setError('Failed to inject capture script. Please use manual setup.');
    }
  };

  const showCaptureInstructions = (popup: Window) => {
    // If we can't inject script due to CORS, show instructions
    setError('Auto-capture requires same-origin access. Please use manual setup or browser extension.');
  };

  const handleSaveCapturedData = async () => {
    if (!capturedData || !user) return;

    setSaving(true);
    try {
      // Prepare form data from captured cookies
      const formData: Record<string, string> = {};
      
      // Map captured cookies to form fields
      actor.fields.forEach((field: any) => {
        if (field.key === 'userAgent') {
          formData[field.key] = capturedData.userAgent;
        } else if (capturedData.cookies[field.key]) {
          formData[field.key] = capturedData.cookies[field.key];
        }
      });

      // Validate required fields
      const missingFields = actor.fields
        .filter((field: any) => field.required && !formData[field.key]?.trim())
        .map((field: any) => field.label);

      if (missingFields.length > 0) {
        throw new Error(`Missing required cookies: ${missingFields.join(', ')}`);
      }

      // Call edge function to encrypt and store
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-credentials`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          actor_slug: actor.slug,
          payload: {
            actor_slug: actor.slug,
            fields: formData,
            user_agent: capturedData.userAgent,
            created_at: capturedData.timestamp,
            capture_method: 'auto'
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save credentials');
      }

      setCurrentStep('save');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);

    } catch (error) {
      console.error('Error saving captured data:', error);
      setError(error instanceof Error ? error.message : 'Failed to save credentials');
    } finally {
      setSaving(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'consent':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                theme === 'gold' ? 'gold-gradient' : 'bg-blue-100'
              }`}>
                <Shield className={`h-8 w-8 ${
                  theme === 'gold' ? 'text-black' : 'text-blue-600'
                }`} />
              </div>
              <h3 className={`text-xl font-bold mb-2 ${
                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
              }`}>
                Cookie Capture Consent
              </h3>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                We need your permission to read authentication cookies from your browser
              </p>
            </div>

            <div className={`p-4 rounded-lg border ${
              theme === 'gold'
                ? 'border-yellow-400/20 bg-yellow-400/5'
                : 'border-blue-200 bg-blue-50'
            }`}>
              <h4 className={`text-sm font-medium mb-3 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
              }`}>
                What we will capture from {consentData.domain}:
              </h4>
              <div className="space-y-2">
                {consentData.cookieNames.map(cookieName => (
                  <div key={cookieName} className="flex items-center space-x-2">
                    <Cookie className={`h-4 w-4 ${
                      theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                    }`} />
                    <code className={`text-sm font-mono ${
                      theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                    }`}>
                      {cookieName}
                    </code>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      actor.fields.find((f: any) => f.key === cookieName)?.required
                        ? theme === 'gold' ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-800'
                        : theme === 'gold' ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {actor.fields.find((f: any) => f.key === cookieName)?.required ? 'Required' : 'Optional'}
                    </span>
                  </div>
                ))}
                <div className="flex items-center space-x-2">
                  <Globe className={`h-4 w-4 ${
                    theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                  }`} />
                  <span className={`text-sm ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    User Agent (browser information)
                  </span>
                </div>
              </div>
            </div>

            <div className={`p-4 rounded-lg ${
              theme === 'gold'
                ? 'bg-green-500/10 border border-green-500/20'
                : 'bg-green-50 border border-green-200'
            }`}>
              <h4 className={`text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-green-400' : 'text-green-700'
              }`}>
                🔒 Privacy & Security Guarantees
              </h4>
              <ul className={`text-sm space-y-1 ${
                theme === 'gold' ? 'text-green-300' : 'text-green-600'
              }`}>
                <li>• Only captures cookies from your own logged-in session</li>
                <li>• No passwords or sensitive personal data collected</li>
                <li>• Credentials encrypted with AES-256 before storage</li>
                <li>• You can revoke access anytime by deleting credentials</li>
                <li>• Only used to access data you're already entitled to see</li>
              </ul>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className={`flex-1 px-4 py-2 text-sm rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                    : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleStartCapture}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'gold-gradient text-black hover-gold'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Shield className="h-4 w-4 mr-2" />
                I Consent - Start Capture
              </button>
            </div>
          </div>
        );

      case 'capture':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                theme === 'gold' ? 'gold-gradient' : 'bg-blue-100'
              }`}>
                {isListening ? (
                  <div className={`animate-spin rounded-full h-8 w-8 border-2 border-transparent ${
                    theme === 'gold' ? 'border-t-black' : 'border-t-blue-600'
                  }`}></div>
                ) : (
                  <Globe className={`h-8 w-8 ${
                    theme === 'gold' ? 'text-black' : 'text-blue-600'
                  }`} />
                )}
              </div>
              <h3 className={`text-xl font-bold mb-2 ${
                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
              }`}>
                {isListening ? 'Waiting for Capture...' : 'Helper Window Opened'}
              </h3>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {isListening 
                  ? 'Complete the steps in the helper window to capture your cookies'
                  : 'A helper window has been opened to capture your cookies'
                }
              </p>
            </div>

            <div className={`p-6 rounded-lg border ${
              theme === 'gold'
                ? 'border-yellow-400/20 bg-yellow-400/5'
                : 'border-blue-200 bg-blue-50'
            }`}>
              <h4 className={`text-lg font-semibold mb-4 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
              }`}>
                Follow these steps in the helper window:
              </h4>
              <ol className={`space-y-3 text-sm ${
                theme === 'gold' ? 'text-yellow-300' : 'text-blue-600'
              }`}>
                <li className="flex items-start space-x-3">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    theme === 'gold' ? 'bg-yellow-400 text-black' : 'bg-blue-600 text-white'
                  }`}>
                    1
                  </span>
                  <span>Log in to your {actor.title} account (if not already logged in)</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    theme === 'gold' ? 'bg-yellow-400 text-black' : 'bg-blue-600 text-white'
                  }`}>
                    2
                  </span>
                  <span>Click the "🍪 Capture Cookies" button when it appears</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    theme === 'gold' ? 'bg-yellow-400 text-black' : 'bg-blue-600 text-white'
                  }`}>
                    3
                  </span>
                  <span>The window will close automatically after capture</span>
                </li>
              </ol>
            </div>

            {error && (
              <div className={`p-4 rounded-lg border ${
                theme === 'gold'
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">{error}</span>
                </div>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  if (helperWindow) {
                    helperWindow.close();
                  }
                  setCurrentStep('consent');
                  setIsListening(false);
                }}
                className={`flex-1 px-4 py-2 text-sm rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                    : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (helperWindow && !helperWindow.closed) {
                    helperWindow.focus();
                  } else {
                    handleStartCapture();
                  }
                }}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  theme === 'gold'
                    ? 'border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Focus Helper Window
              </button>
            </div>
          </div>
        );

      case 'preview':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                theme === 'gold' ? 'bg-green-500/20' : 'bg-green-100'
              }`}>
                <CheckCircle className={`h-8 w-8 ${
                  theme === 'gold' ? 'text-green-400' : 'text-green-600'
                }`} />
              </div>
              <h3 className={`text-xl font-bold mb-2 ${
                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
              }`}>
                Cookies Captured Successfully!
              </h3>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Review the captured data before saving
              </p>
            </div>

            {capturedData && (
              <div className={`p-4 rounded-lg border ${
                theme === 'gold'
                  ? 'border-yellow-400/20 bg-black/20'
                  : 'border-gray-200 bg-gray-50'
              }`}>
                <h4 className={`text-sm font-medium mb-3 ${
                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Captured Data Preview:
                </h4>
                
                <div className="space-y-3">
                  {/* Domain */}
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Domain:
                    </span>
                    <span className={`text-sm font-mono ${
                      theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                    }`}>
                      {capturedData.domain}
                    </span>
                  </div>

                  {/* User Agent */}
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      User Agent:
                    </span>
                    <span className={`text-sm font-mono truncate max-w-xs ${
                      theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                    }`}>
                      {capturedData.userAgent.substring(0, 50)}...
                    </span>
                  </div>

                  {/* Cookies */}
                  <div>
                    <span className={`text-sm ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Cookies Captured:
                    </span>
                    <div className="mt-2 space-y-2">
                      {Object.entries(capturedData.cookies).map(([key, value]) => (
                        <div key={key} className={`flex items-center justify-between p-2 rounded ${
                          theme === 'gold' ? 'bg-black/30' : 'bg-white'
                        }`}>
                          <div className="flex items-center space-x-2">
                            <CheckCircle className={`h-4 w-4 ${
                              theme === 'gold' ? 'text-green-400' : 'text-green-600'
                            }`} />
                            <code className={`text-sm font-mono ${
                              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                            }`}>
                              {key}
                            </code>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`text-xs font-mono ${
                              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              {showPreview[key] ? value : '••••••••••••••••'}
                            </span>
                            <button
                              onClick={() => setShowPreview(prev => ({
                                ...prev,
                                [key]: !prev[key]
                              }))}
                              className={`p-1 rounded transition-colors ${
                                theme === 'gold' ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'
                              }`}
                            >
                              {showPreview[key] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => setCurrentStep('consent')}
                className={`flex-1 px-4 py-2 text-sm rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                    : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Back
              </button>
              <button
                onClick={handleSaveCapturedData}
                disabled={saving}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'gold-gradient text-black hover-gold'
                    : 'bg-green-600 text-white hover:bg-green-700'
                } disabled:opacity-50`}
              >
                {saving ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    Encrypting & Saving...
                  </div>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Save & Encrypt
                  </>
                )}
              </button>
            </div>
          </div>
        );

      case 'save':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                theme === 'gold' ? 'bg-green-500/20' : 'bg-green-100'
              }`}>
                <CheckCircle className={`h-8 w-8 ${
                  theme === 'gold' ? 'text-green-400' : 'text-green-600'
                }`} />
              </div>
              <h3 className={`text-xl font-bold mb-2 ${
                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
              }`}>
                {actor.title} Connected Successfully!
              </h3>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Your credentials have been encrypted and stored securely
              </p>
            </div>

            <div className={`p-4 rounded-lg ${
              theme === 'gold'
                ? 'bg-green-500/10 border border-green-500/20'
                : 'bg-green-50 border border-green-200'
            }`}>
              <h4 className={`text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-green-400' : 'text-green-700'
              }`}>
                ✅ What happens next:
              </h4>
              <ul className={`text-sm space-y-1 ${
                theme === 'gold' ? 'text-green-300' : 'text-green-600'
              }`}>
                <li>• Your {actor.title} integration is now ready to use</li>
                <li>• Credentials will be automatically verified</li>
                <li>• You can now discover leads from {actor.title}</li>
                <li>• Integration status will show as "Connected"</li>
              </ul>
            </div>
          </div>
        );

      default:
        return null;
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
                <div className="text-2xl">
                  {actor.category === 'social' ? '👥' :
                   actor.category === 'maps' ? '🗺️' :
                   actor.category === 'jobs' ? '💼' :
                   actor.category === 'enrichment' ? '🔍' :
                   actor.category === 'search' ? '🔎' :
                   actor.category === 'developer' ? '👨‍💻' :
                   actor.category === 'academic' ? '🎓' :
                   actor.category === 'community' ? '💬' : '⚙️'}
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    Auto-Capture: {actor.title}
                  </h2>
                  <p className={`text-sm ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Secure cookie capture from {actor.targetDomain}
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

          {/* Progress Steps */}
          <div className={`p-4 border-b ${
            theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
          }`}>
            <div className="flex items-center space-x-2">
              {['consent', 'capture', 'preview', 'save'].map((step, index) => (
                <React.Fragment key={step}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    currentStep === step
                      ? theme === 'gold' ? 'gold-gradient text-black' : 'bg-blue-600 text-white'
                      : ['consent', 'capture', 'preview'].indexOf(currentStep) > index
                      ? theme === 'gold' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'
                      : theme === 'gold' ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {['consent', 'capture', 'preview'].indexOf(currentStep) > index ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  {index < 3 && (
                    <div className={`flex-1 h-0.5 ${
                      ['consent', 'capture', 'preview'].indexOf(currentStep) > index
                        ? theme === 'gold' ? 'bg-green-400' : 'bg-green-500'
                        : theme === 'gold' ? 'bg-gray-700' : 'bg-gray-300'
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="p-6">
            {renderStepContent()}
          </div>
        </div>
      </div>
    </div>
  );
}