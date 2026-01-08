const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'An error occurred');
  }
  
  return response.json();
}

// Stats
export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalMessages: number;
  totalRevenue: number;
  recentPayments: Payment[];
  topUsers: User[];
  messagesPerDay: { _id: string; count: number }[];
  revenuePerDay: { _id: string; amount: number }[];
}

export async function getStats(): Promise<DashboardStats> {
  return apiRequest('/api/stats');
}

// Users
export interface User {
  _id: string;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  freeMessagesUsed: number;
  freeMessagesLimit: number;
  credits: number;
  totalMessagesSent: number;
  isPremium: boolean;
  premiumUntil?: string;
  isAdmin: boolean;
  isBanned: boolean;
  banReason?: string;
  isAuthorized: boolean;
  totalSpent: number;
  createdAt: string;
  lastActiveAt: string;
}

export interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  totalPages: number;
}

export async function getUsers(
  page = 1,
  limit = 20,
  search?: string
): Promise<UsersResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  return apiRequest(`/api/users?${params}`);
}

export async function getUser(telegramId: number) {
  return apiRequest<{ user: User; messages: unknown[]; payments: Payment[] }>(
    `/api/users/${telegramId}`
  );
}

export async function updateUser(telegramId: number, updates: Partial<User>) {
  return apiRequest<User>(`/api/users/${telegramId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function addCredits(telegramId: number, amount: number) {
  return apiRequest<User>(`/api/users/${telegramId}/add-credits`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

// Payments
export interface Payment {
  _id: string;
  userId: { telegramId: number; username?: string; firstName?: string };
  telegramId: number;
  stripePaymentIntentId: string;
  amount: number;
  type: 'credits' | 'premium';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: string;
}

export interface PaymentsResponse {
  payments: Payment[];
  total: number;
  page: number;
  totalPages: number;
}

export async function getPayments(
  page = 1,
  limit = 20,
  status?: string
): Promise<PaymentsResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set('status', status);
  return apiRequest(`/api/payments?${params}`);
}

export interface Settings {
  freeMessagesLimit: number;
  costPerMessage: number;
  premiumEnabled: boolean;
  premiumMonthlyPrice: number;
  premiumYearlyPrice: number;
  maintenanceMode: boolean;
  privateMode: boolean;
  accessCodes: string[];
  creditPackages: {
    id: string;
    name: string;
    credits: number;
    price: number;
    popular?: boolean;
  }[];
}

export async function getSettings(): Promise<Settings> {
  return apiRequest('/api/settings');
}

export async function updateSettings(updates: Partial<Settings>) {
  return apiRequest<Settings>('/api/settings', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}
