import { useCallback } from 'react';

interface ProcessedError {
  message: string;
  code?: string;
  type: 'validation' | 'network' | 'auth' | 'server' | 'unknown';
}

export function useErrorHandler() {
  const handleError = useCallback((error: any, context?: string): ProcessedError => {
    console.error(`Error in ${context || 'unknown context'}:`, error);

    // Handle Supabase errors
    if (error?.code) {
      switch (error.code) {
        case 'invalid_credentials':
          return {
            message: 'Invalid email or password. Please check your credentials.',
            code: error.code,
            type: 'auth'
          };
        case 'email_not_confirmed':
          return {
            message: 'Please verify your email address before signing in.',
            code: error.code,
            type: 'auth'
          };
        case 'too_many_requests':
          return {
            message: 'Too many requests. Please wait a moment before trying again.',
            code: error.code,
            type: 'network'
          };
        default:
          return {
            message: error.message || 'An unexpected error occurred.',
            code: error.code,
            type: 'server'
          };
      }
    }

    // Handle network errors
    if (error?.name === 'NetworkError' || error?.message?.includes('fetch')) {
      return {
        message: 'Network error. Please check your connection and try again.',
        type: 'network'
      };
    }

    // Handle validation errors
    if (error?.message?.includes('validation') || error?.message?.includes('required')) {
      return {
        message: error.message,
        type: 'validation'
      };
    }

    // Default error handling
    return {
      message: error?.message || 'An unexpected error occurred. Please try again.',
      type: 'unknown'
    };
  }, []);

  const handleAsyncError = useCallback(async (
    asyncFunction: () => Promise<void>,
    context?: string
  ): Promise<ProcessedError | null> => {
    try {
      await asyncFunction();
      return null;
    } catch (error) {
      return handleError(error, context);
    }
  }, [handleError]);

  return {
    handleError,
    handleAsyncError,
  };
}