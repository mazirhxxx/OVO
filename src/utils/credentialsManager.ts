export interface ActorField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'textarea' | 'select';
  required: boolean;
  mask: boolean;
  helper?: string;
}

export interface Actor {
  slug: string;
  title: string;
  category: string;
  requiresCookies: boolean;
  targetDomain: string;
  fields: ActorField[];
  verifyHint: string;
}

export interface UserCredential {
  id: string;
  actor_slug: string;
  status: 'connected' | 'expired' | 'failed' | 'unverified';
  last_verified_at: string | null;
  verification_attempts: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CapturedCredentials {
  cookies: Record<string, string>;
  userAgent: string;
  domain: string;
  timestamp: string;
  captureMethod: 'auto' | 'manual';
}

export class CredentialsManager {
  static async storeCredentials(
    userId: string,
    actorSlug: string,
    credentials: CapturedCredentials,
    supabase: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-credentials`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          actor_slug: actorSlug,
          payload: {
            actor_slug: actorSlug,
            fields: credentials.cookies,
            user_agent: credentials.userAgent,
            created_at: credentials.timestamp,
            capture_method: credentials.captureMethod
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Failed to store credentials' };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  static async verifyCredentials(
    userId: string,
    actorSlug: string,
    supabase: any
  ): Promise<{ success: boolean; status: string; error?: string }> {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-credentials`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          actor_slug: actorSlug
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { 
          success: false, 
          status: 'failed',
          error: errorData.error || 'Verification failed' 
        };
      }

      const result = await response.json();
      return { 
        success: true, 
        status: result.credential_status || 'verified'
      };
    } catch (error) {
      return { 
        success: false, 
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  static async getCredentialsForActor(
    userId: string,
    actorSlug: string,
    supabase: any
  ): Promise<{ success: boolean; credentials?: any; error?: string }> {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-actor-credentials`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          actor_slug: actorSlug
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Failed to get credentials' };
      }

      const result = await response.json();
      return { success: true, credentials: result.credentials };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  static parseCookieString(cookieString: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    
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
    
    return cookies;
  }

  static validateCredentials(actor: Actor, formData: Record<string, string>): string[] {
    const errors: string[] = [];
    
    actor.fields.forEach(field => {
      if (field.required && (!formData[field.key] || !formData[field.key].trim())) {
        errors.push(`${field.label} is required`);
      }
    });
    
    return errors;
  }

  static maskValue(value: string, showLength: number = 4): string {
    if (value.length <= showLength) {
      return '••••';
    }
    return value.substring(0, showLength) + '••••••••••••••••';
  }
}