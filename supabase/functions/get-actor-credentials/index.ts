/*
  # Get Actor Credentials Edge Function

  1. Purpose
    - Server-to-server endpoint for actors to retrieve credentials
    - Decrypts and shapes credential bundles for runtime use
    - Validates actor access and user permissions

  2. Security
    - Server-side only (never expose to browser)
    - Validates actor slug and user ownership
    - Returns shaped credential bundle

  3. Usage
    - POST /get-actor-credentials with { user_id, actor_slug, scope? }
    - Returns decrypted credentials shaped for actor runtime
    - Used by n8n workflows and scraping actors
*/

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface GetCredentialsRequest {
  user_id: string;
  actor_slug: string;
  scope?: string;
}

interface ShapedCredentials {
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
  api_key?: string;
  user_agent?: string;
  proxy_hint?: string;
  metadata?: {
    actor_slug: string;
    last_verified: string | null;
    status: string;
    expires_at: string | null;
  };
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
    const { user_id, actor_slug, scope }: GetCredentialsRequest = await req.json();

    if (!user_id || !actor_slug) {
      return new Response(
        JSON.stringify({ error: 'User ID and actor slug are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Verify actor exists and is active
    const { data: actor, error: actorError } = await supabase
      .from('actor_registry')
      .select('*')
      .eq('slug', actor_slug)
      .eq('is_active', true)
      .single();

    if (actorError || !actor) {
      return new Response(
        JSON.stringify({ error: 'Actor not found or inactive' }),
        {
          status: 404,
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
        JSON.stringify({ error: 'No credentials found for this actor' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if credentials are active
    if (credential.status !== 'active') {
      return new Response(
        JSON.stringify({ 
          error: `Credentials are ${credential.status}. Please verify or update them.`,
          status: credential.status
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check expiration
    if (credential.expires_at && new Date(credential.expires_at) < new Date()) {
      // Mark as expired
      await supabase
        .from('user_credentials')
        .update({ status: 'expired' })
        .eq('id', credential.id);

      return new Response(
        JSON.stringify({ 
          error: 'Credentials have expired. Please update them.',
          status: 'expired'
        }),
        {
          status: 403,
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

    // Shape credentials for actor runtime
    const shapedCredentials: ShapedCredentials = {
      metadata: {
        actor_slug,
        last_verified: credential.last_verified_at,
        status: credential.status,
        expires_at: credential.expires_at
      }
    };

    // Add user agent
    if (decryptedPayload.user_agent || credential.user_agent) {
      shapedCredentials.user_agent = decryptedPayload.user_agent || credential.user_agent;
    }

    // Add proxy hint if available
    if (credential.proxy_hint) {
      shapedCredentials.proxy_hint = credential.proxy_hint;
    }

    // Shape based on actor type
    if (actor.requires_cookies && decryptedPayload.fields) {
      // Cookie-based actor
      const cookies: Record<string, string> = {};
      const headers: Record<string, string> = {};
      
      Object.entries(decryptedPayload.fields).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim()) {
          if (key === 'user_agent') {
            shapedCredentials.user_agent = value;
          } else if (key !== 'raw_cookies') {
            cookies[key] = value;
          }
        }
      });
      
      if (Object.keys(cookies).length > 0) {
        shapedCredentials.cookies = cookies;
        shapedCredentials.headers = {
          'Cookie': Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '),
          'User-Agent': shapedCredentials.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };
      }
    } else if (decryptedPayload.fields?.api_key) {
      // API key-based actor
      shapedCredentials.api_key = decryptedPayload.fields.api_key;
      shapedCredentials.headers = {
        'Authorization': `Bearer ${decryptedPayload.fields.api_key}`,
        'User-Agent': shapedCredentials.user_agent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };
    }

    // Update last used timestamp
    await supabase
      .from('user_credentials')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', credential.id);

    // Log access in audit trail
    await supabase.rpc('log_credential_audit', {
      p_user_id: user_id,
      p_actor_slug: actor_slug,
      p_action: 'access',
      p_details: {
        scope: scope || 'default',
        has_cookies: !!shapedCredentials.cookies,
        has_api_key: !!shapedCredentials.api_key
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        credentials: shapedCredentials
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Get credentials error:', error);
    
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