/*
  # Store Credentials Edge Function

  1. Purpose
    - Encrypt and store user credentials for scraping actors
    - Validate credential format and requirements
    - Log audit trail for security

  2. Security
    - Server-side encryption using pgcrypto
    - Input validation and sanitization
    - Audit logging for all operations

  3. Usage
    - POST /store-credentials with { user_id, actor_slug, payload }
    - Returns success/failure status
    - Automatically encrypts sensitive data
*/

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface StoreCredentialsRequest {
  user_id: string;
  actor_slug: string;
  payload: {
    actor_slug: string;
    fields: Record<string, string>;
    user_agent: string;
    created_at: string;
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
    const { user_id, actor_slug, payload }: StoreCredentialsRequest = await req.json();

    if (!user_id || !actor_slug || !payload) {
      return new Response(
        JSON.stringify({ error: 'User ID, actor slug, and payload are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Verify actor exists
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

    // Get actor field requirements
    const { data: fields, error: fieldsError } = await supabase
      .from('actor_fields')
      .select('*')
      .eq('actor_slug', actor_slug);

    if (fieldsError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch actor field requirements' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate required fields
    const requiredFields = fields?.filter(f => f.is_required) || [];
    const missingFields = requiredFields.filter(field => 
      !payload.fields[field.field_key]?.trim()
    );

    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: `Missing required fields: ${missingFields.map(f => f.field_label).join(', ')}` 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Encrypt the payload using PostgreSQL's pgcrypto
    const encryptionKey = Deno.env.get('CREDENTIALS_ENCRYPTION_KEY') || 'default-vault-key';
    
    const { data: encryptResult, error: encryptError } = await supabase
      .rpc('encrypt_credentials', {
        payload: payload,
        encryption_key: encryptionKey
      });

    if (encryptError) {
      console.error('Encryption error:', encryptError);
      return new Response(
        JSON.stringify({ error: 'Failed to encrypt credentials' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Store encrypted credentials
    const { data: credentialData, error: storeError } = await supabase
      .from('user_credentials')
      .upsert({
        user_id,
        actor_slug,
        encrypted_payload: encryptResult,
        status: 'unverified',
        user_agent: payload.user_agent,
        verification_attempts: 0,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,actor_slug'
      })
      .select()
      .single();

    if (storeError) {
      console.error('Store error:', storeError);
      return new Response(
        JSON.stringify({ error: 'Failed to store credentials' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Log audit trail
    await supabase.rpc('log_credential_audit', {
      p_user_id: user_id,
      p_actor_slug: actor_slug,
      p_action: 'create',
      p_details: {
        fields_provided: Object.keys(payload.fields),
        has_user_agent: !!payload.user_agent
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        credential_id: credentialData.id,
        status: credentialData.status,
        message: 'Credentials stored successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Store credentials error:', error);
    
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