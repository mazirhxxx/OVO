import { useState, useCallback } from 'react';

interface LoadingStateOptions {
  successMessage?: string | null;
  errorMessage?: string | null;
}

export function useLoadingState() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const executeAsync = useCallback(async (
    asyncFunction: () => Promise<void>,
    options: LoadingStateOptions = {}
  ) => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      await asyncFunction();
      if (options.successMessage) {
        setSuccess(options.successMessage);
      }
    } catch (err) {
      const errorMessage = options.errorMessage || 
        (err instanceof Error ? err.message : 'An unexpected error occurred');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    success,
    setError,
    setSuccess,
    executeAsync,
  };
}