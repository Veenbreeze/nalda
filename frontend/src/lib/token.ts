const TOKEN_KEY = 'nalda_access_token';

let accessToken: string | null = localStorage.getItem(TOKEN_KEY);

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}
