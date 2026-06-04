import { MESSAGER_API_BASE_URL } from '@env';

const DEFAULT_API_BASE_URL = 'http://10.0.2.2:5000';

export const API_BASE_URL =
  MESSAGER_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
