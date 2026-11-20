import { computed, reactive } from 'vue';
import { request } from '@/lib/api';
import type { AuthResponse, User } from '@/types';

const TOKEN_KEY = 'ant_sms_token';
const USER_KEY = 'ant_sms_user';

function readStoredUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null') as User | null;
  } catch {
    return null;
  }
}

export const auth = reactive({
  token: localStorage.getItem(TOKEN_KEY),
  user: readStoredUser(),
});

export const isAuthenticated = computed(() => Boolean(auth.token));
export const role = computed<'admin' | 'dealer' | 'consumer'>(() => {
  if (auth.user?.is_admin) return 'admin';
  if (auth.user?.is_card_dealer) return 'dealer';
  return 'consumer';
});

function persist(): void {
  if (auth.token) localStorage.setItem(TOKEN_KEY, auth.token);
  else localStorage.removeItem(TOKEN_KEY);
  if (auth.user) localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
  else localStorage.removeItem(USER_KEY);
}

function setSession(token: string, user: User): void {
  auth.token = token;
  auth.user = user;
  persist();
}

export async function login(username: string, password: string): Promise<User> {
  const data = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { username, password },
  });
  setSession(data.token, data.user);
  return data.user;
}

export async function register(payload: {
  username: string;
  password: string;
  is_card_dealer?: boolean;
  invite_code?: string;
}): Promise<User> {
  const data = await request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: payload,
  });
  setSession(data.token, data.user);
  return data.user;
}

export async function refreshMe(): Promise<User> {
  const data = await request<{ user: User }>('/auth/me');
  auth.user = data.user;
  persist();
  return data.user;
}

export function setBalance(balance: number): void {
  if (!auth.user) return;
  auth.user.balance = balance;
  persist();
}

export function clearSession(): void {
  auth.token = null;
  auth.user = null;
  persist();
}

export function logout(): void {
  clearSession();
}
