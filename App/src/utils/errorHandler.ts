export type ApiError = {
  message: string;
  code?: string;
  details?: string;
};

export function extractErrorMessage(error: unknown): ApiError {
  if (error instanceof Error) {
    const apiError: ApiError = {
      message: error.message,
    };

    if ('code' in error && typeof error.code === 'string') {
      apiError.code = error.code;
    }

    if ('response' in error && error.response) {
      const response = error.response as any;
      if (response.data?.message) {
        apiError.message = response.data.message;
      }
      if (response.status) {
        apiError.code = `HTTP ${response.status}`;
      }
      if (response.data?.details) {
        apiError.details = response.data.details;
      }
    }

    return apiError;
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  if (error && typeof error === 'object') {
    const err = error as any;
    return {
      message: err.message || 'Nieznany błąd',
      code: err.code,
      details: err.details,
    };
  }

  return { message: 'Nieznany błąd' };
}

export function createUserFriendlyMessage(error: ApiError): string {
  const codeMap: Record<string, string> = {
    'HTTP 400': 'Nieprawidłowe dane',
    'HTTP 401': 'Sesja wygasła, zaloguj się ponownie',
    'HTTP 403': 'Brak dostępu',
    'HTTP 404': 'Nie znaleziono',
    'HTTP 409': 'Konflikt danych',
    'HTTP 500': 'Błąd serwera',
    'HTTP 503': 'Serwer niedostępny',
    NETWORK_ERROR: 'Brak połączenia',
    TIMEOUT: 'Próba połączenia przekroczyła czas',
  };

  if (error.code && codeMap[error.code]) {
    return codeMap[error.code];
  }

  return error.message || 'Coś poszło nie tak';
}
