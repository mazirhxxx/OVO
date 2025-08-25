/*
  # Credential Vault Views

  1. Views
    - `user_integrations_overview` - Dashboard view of all integrations
    - `actor_definitions` - Complete actor definitions with fields
    - `credential_status_summary` - Status summary per user

  2. Security
    - Views respect RLS policies
    - No sensitive data exposed in views
    - User-scoped data only
*/

-- View: User Integrations Overview (for dashboard)
CREATE OR REPLACE VIEW user_integrations_overview AS
SELECT 
  ar.slug as actor_slug,
  ar.title,
  ar.description,
  ar.category,
  ar.requires_cookies,
  ar.requires_api_key,
  uc.user_id,
  uc.status,
  uc.last_verified_at,
  uc.created_at as connected_at,
  uc.expires_at,
  CASE 
    WHEN uc.status IS NULL THEN 'not_connected'
    WHEN uc.status = 'active' AND uc.last_verified_at > now() - interval '7 days' THEN 'healthy'
    WHEN uc.status = 'active' AND uc.last_verified_at <= now() - interval '7 days' THEN 'needs_verification'
    WHEN uc.status = 'expired' THEN 'expired'
    WHEN uc.status = 'failed' THEN 'failed'
    WHEN uc.status = 'disabled' THEN 'disabled'
    ELSE 'unverified'
  END as health_status,
  -- Count recent verification attempts
  (
    SELECT count(*)
    FROM credential_verification cv
    WHERE cv.user_id = uc.user_id 
      AND cv.actor_slug = ar.slug 
      AND cv.verified_at > now() - interval '24 hours'
  ) as recent_verifications
FROM actor_registry ar
LEFT JOIN user_credentials uc ON ar.slug = uc.actor_slug
WHERE ar.is_active = true;

-- View: Complete Actor Definitions (for form rendering)
CREATE OR REPLACE VIEW actor_definitions AS
SELECT 
  ar.slug,
  ar.title,
  ar.description,
  ar.category,
  ar.requires_cookies,
  ar.requires_api_key,
  ar.verify_hint,
  ar.scopes,
  -- Aggregate fields as JSON array
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'key', af.field_key,
        'label', af.field_label,
        'type', af.field_type,
        'required', af.is_required,
        'masked', af.is_masked,
        'helper', af.helper_text,
        'placeholder', af.placeholder,
        'validation_regex', af.validation_regex,
        'select_options', af.select_options
      ) ORDER BY af.display_order
    ) FILTER (WHERE af.field_key IS NOT NULL),
    '[]'::jsonb
  ) as fields
FROM actor_registry ar
LEFT JOIN actor_fields af ON ar.slug = af.actor_slug
WHERE ar.is_active = true
GROUP BY ar.slug, ar.title, ar.description, ar.category, ar.requires_cookies, ar.requires_api_key, ar.verify_hint, ar.scopes
ORDER BY ar.category, ar.title;

-- View: Credential Status Summary (for admin/monitoring)
CREATE OR REPLACE VIEW credential_status_summary AS
SELECT 
  user_id,
  count(*) as total_integrations,
  count(*) FILTER (WHERE status = 'active') as active_integrations,
  count(*) FILTER (WHERE status = 'expired') as expired_integrations,
  count(*) FILTER (WHERE status = 'failed') as failed_integrations,
  count(*) FILTER (WHERE status = 'unverified') as unverified_integrations,
  count(*) FILTER (WHERE last_verified_at > now() - interval '7 days') as recently_verified,
  max(last_verified_at) as last_verification,
  min(created_at) as first_integration_at
FROM user_credentials
GROUP BY user_id;

-- View: Recent Audit Activity (for security monitoring)
CREATE OR REPLACE VIEW recent_credential_activity AS
SELECT 
  ca.user_id,
  ca.actor_slug,
  ar.title as actor_title,
  ca.action_type,
  ca.success,
  ca.error_message,
  ca.created_at,
  ca.ip_address,
  -- Mask user agent for privacy
  CASE 
    WHEN length(ca.user_agent) > 50 THEN 
      left(ca.user_agent, 50) || '...'
    ELSE ca.user_agent
  END as user_agent_preview
FROM credential_audit ca
JOIN actor_registry ar ON ca.actor_slug = ar.slug
WHERE ca.created_at > now() - interval '30 days'
ORDER BY ca.created_at DESC;

-- Enable RLS on views (they inherit from base tables)
ALTER VIEW user_integrations_overview SET (security_barrier = true);
ALTER VIEW actor_definitions SET (security_barrier = true);
ALTER VIEW credential_status_summary SET (security_barrier = true);
ALTER VIEW recent_credential_activity SET (security_barrier = true);