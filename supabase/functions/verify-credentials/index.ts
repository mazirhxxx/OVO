/*
  # Verify Credentials Edge Function

  1. Purpose
    - Test stored credentials with lightweight verification requests
    - Update credential status based on verification results
    - Record verification history and audit trail

  2. Security
    - Decrypts credentials server-side only
    - Rate limiting on verification attempts
    - Comprehensive audit logging

  3. Usage
    - POST /verify-credentials with { user_id, actor_slug }
    - Returns verification status and details
    - Updates credential status in database
*/

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface VerifyCredentialsRequest {
  user_id: string;
  actor_slug: string;
}

interface VerificationResult {
  status: 'pass' | 'fail' | 'error';
  response_code?: number;
  response_details?: any;
  error_message?: string;
  duration_ms: number;
}

// Actor-specific verification functions
const verificationEndpoints = {
  'linkedin-basic': {
    url: 'https://www.linkedin.com/feed/',
    method: 'GET',
    successIndicators: ['LinkedIn', 'feed-identity-module', 'global-nav']
  },
  'linkedin-sales-navigator': {
    url: 'https://www.linkedin.com/sales/homepage',
    method: 'GET',
    successIndicators: ['Sales Navigator', 'sales-nav']
  },
  'x-twitter': {
    url: 'https://twitter.com/settings/account',
    method: 'GET',
    successIndicators: ['settings', 'account']
  },
  'facebook-groups': {
    url: 'https://www.facebook.com/groups/feed/',
    method: 'GET',
    successIndicators: ['groups', 'feed']
  },
  'facebook-pages': {
    url: 'https://www.facebook.com/pages/',
    method: 'GET',
    successIndicators: ['pages']
  },
  'instagram-basic': {
    url: 'https://www.instagram.com/accounts/edit/',
    method: 'GET',
    successIndicators: ['accounts', 'edit']
  },
  'reddit-auth': {
    url: 'https://www.reddit.com/api/me.json',
    method: 'GET',
    successIndicators: ['name', 'id']
  },
  'google-maps': {
    url: 'https://maps.google.com/maps/search/',
    method: 'GET',
    successIndicators: ['maps', 'search']
  },
  'indeed-jobs': {
    url: 'https://secure.indeed.com/account/myaccount',
    method: 'GET',
    successIndicators: ['account', 'myaccount']
  },
  'glassdoor': {
    url: 'https://www.glassdoor.com/member/home/',
    method: 'GET',
    successIndicators: ['member', 'home']
  },
  'apollo-portal': {
    url: 'https://app.apollo.io/api/v1/auth/health',
    method: 'GET',
    successIndicators: ['health', 'authenticated']
  },
  'hunter-io': {
    url: 'https://api.hunter.io/v2/account',
    method: 'GET',
    successIndicators: ['data', 'email']
  },
  'people-data-labs': {
    url: 'https://api.peopledatalabs.com/v5/person/search',
    method: 'GET',
    successIndicators: ['status', 'data']
  },
  'github-scraper': {
    url: 'https://api.github.com/user',
    method: 'GET',
    successIndicators: ['login', 'id']
  }
};

async function performVerification(
  actor_slug: string, 
  credentials: any
): Promise<VerificationResult> {
  const startTime = Date.now();
  
  try {
    const endpoint = verificationEndpoints[actor_slug as keyof typeof verificationEndpoints];
    
    if (!endpoint) {
      return {
        status: 'error',
        error_message: 'No verification endpoint configured for this actor',
        duration_ms: Date.now() - startTime
      };
    }

    // Prepare headers
    const headers: Record<string, string> = {
      'User-Agent': credentials.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    // Add cookies for cookie-based actors
    if (credentials.fields) {
      const cookiePairs: string[] = [];
      Object.entries(credentials.fields).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim() && key !== 'user_agent' && key !== 'raw_cookies') {
          cookiePairs.push(`${key}=${value}`);
        }
      });
      
      if (cookiePairs.length > 0) {
        headers['Cookie'] = cookiePairs.join('; ');
      }
    }

    // Add API key for API-based actors
    if (credentials.fields?.api_key) {
      if (actor_slug === 'hunter-io') {
        headers['Authorization'] = `Bearer ${credentials.fields.api_key}`;
      } else if (actor_slug === 'people-data-labs') {
        headers['X-Api-Key'] = credentials.fields.api_key;
      } else {
        headers['Authorization'] = `Bearer ${credentials.fields.api_key}`;
      }
    }

    // Make verification request
    const response = await fetch(endpoint.url, {
      method: endpoint.method,
      headers,
      // Don't follow redirects for login checks
      redirect: 'manual'
    });

    const responseText = await response.text();
    const duration_ms = Date.now() - startTime;

    // Check for success indicators
    const hasSuccessIndicators = endpoint.successIndicators.some(indicator =>
      responseText.toLowerCase().includes(indicator.toLowerCase())
    );

    // Determine verification status
    let status: 'pass' | 'fail' | 'error' = 'fail';
    
    if (response.status === 200 && hasSuccessIndicators) {
      status = 'pass';
    } else if (response.status === 401 || response.status === 403) {
      status = 'fail';
    } else if (response.status >= 500) {
      status = 'error';
    } else if (response.status === 302 || response.status === 301) {
      // Redirects might indicate login required
      const location = response.headers.get('location') || '';
      if (location.includes('login') || location.includes('signin') || location.includes('auth')) {
        status = 'fail';
      } else {
        status = 'pass'; // Redirect to expected page
      }
    }

    return {
      status,
      response_code: response.status,
      response_details: {
        url: endpoint.url,
        has_success_indicators: hasSuccessIndicators,
        response_length: responseText.length,
        redirect_location: response.headers.get('location')
      },
      duration_ms
    };

  } catch (error) {
    return {
      status: 'error',
      error_message: error instanceof Error ? error.message : 'Verification request failed',
      duration_ms: Date.now() - startTime
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request
    const { user_id, actor_slug }: VerifyCredentialsRequest = await req.json();

    if (!user_id || !actor_slug) {
      return new Response(
        JSON.stringify({ error: 'User ID and actor slug are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get user credentials
    const { data: credential, error: credentialError } = await supabase
      .from('user_credentials')
      .select('*')
      .eq('user_id', user_id)
      .eq('actor_slug', actor_slug)
      .single();

    if (credentialError || !credential) {
      return new Response(
        JSON.stringify({ error: 'Credentials not found for this actor' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check rate limiting
    if (credential.verification_attempts >= credential.max_verification_attempts) {
      return new Response(
        JSON.stringify({ 
          error: 'Maximum verification attempts exceeded. Please update your credentials.' 
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Decrypt credentials
    const encryptionKey = Deno.env.get('CREDENTIALS_ENCRYPTION_KEY') || 'default-vault-key';
    
    const { data: decryptedPayload, error: decryptError } = await supabase
      .rpc('decrypt_credentials', {
        encrypted_payload: credential.encrypted_payload,
        encryption_key: encryptionKey
      });

    if (decryptError || !decryptedPayload) {
      return new Response(
        JSON.stringify({ error: 'Failed to decrypt credentials' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Perform verification
    const verificationResult = await performVerification(actor_slug, decryptedPayload);

    // Record verification attempt
    await supabase.rpc('record_verification_attempt', {
      p_credential_id: credential.id,
      p_status: verificationResult.status,
      p_response_code: verificationResult.response_code,
      p_response_details: verificationResult.response_details,
      p_error_message: verificationResult.error_message,
      p_duration_ms: verificationResult.duration_ms
    });

    // Log audit trail
    await supabase.rpc('log_credential_audit', {
      p_user_id: user_id,
      p_actor_slug: actor_slug,
      p_action: 'verify',
      p_details: {
        status: verificationResult.status,
        response_code: verificationResult.response_code,
        duration_ms: verificationResult.duration_ms
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        verification: verificationResult,
        credential_status: verificationResult.status === 'pass' ? 'active' : 'failed'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Verify credentials error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});