export interface User {
  id: number;
  username: string;
  is_card_dealer: boolean;
  is_admin: boolean;
  parent_id: number | null;
  invite_code: string;
  balance: number;
  status: number;
  created_at: string;
}

export interface CardGroup {
  id: number;
  user_id: number;
  name: string;
  remark: string | null;
  card_count?: number;
  created_at: string;
}

export interface Card {
  id: number;
  user_id: number;
  group_id: number | null;
  group_name?: string | null;
  projects_price: string;
  phone: string;
  device_id: string | null;
  remark: string | null;
  status: number;
  last_seen_at: string | null;
  created_at: string;
  owner_name?: string | null;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  price: number;
  status: number;
  created_at: string;
}

export interface DealerProject {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  base_price: number;
  base_status: number;
  status: number;
  price: number;
  override_id: number | null;
}

export interface Sms {
  id: number;
  project_id: number;
  project_name?: string | null;
  user_id: number;
  phone: string;

  verifycode: string;
  content: string;
  consumer_user_id: number | null;
  consumed_points: number;
  created_at: string;
}

export interface SmsRead { id: number; sms_id: number; points: number; created_at: string; phone: string; content: string; project_id: number; project_name: string | null; }
export interface Stats { balance: number; username: string; is_card_dealer: boolean; is_admin: boolean; invite_code: string; users?: number; dealers?: number; cards?: number; projects?: number; sms?: number; income?: number; reads?: number; spent?: number; }
export interface Paged<T> { items: T[]; total: number; page: number; page_size: number; }
export interface AcquirePhoneResult {  phone?: string | null; occupationRecordId?: number | null; charged: number;}
export interface LatestResult { sms: Sms | null; phone?: string | null; charged: number; already_read: boolean; balance: number; }
export interface ReleasePhoneResult { released: boolean; refunded: number; balance: number; }

export interface AdminUser { id: number; username: string; is_card_dealer: boolean; is_admin: boolean; parent_id: number | null; invite_code: string; balance: number; status: number; created_at: string; }
export interface AuthResponse { token: string; user: User; }
