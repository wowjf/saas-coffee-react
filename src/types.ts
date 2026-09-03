export type UserRole = 'customer' | 'staff' | 'manager';
export type UserGender = 'female' | 'male';

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
  image?: string;
  inStock: boolean;
  ingredients?: string[];
  preparationTime?: number; // minutes
  averageRating?: number;
  reviewCount?: number;
}

export interface Order {
  id: string;
  userId: string;
  userName: string;
  items: { product: Product; quantity: number }[];
  total: number;
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'rejected';
  timestamp: string;
  note?: string;
  cancelReason?: string;
  tableNumber?: string;
  tableSessionToken?: string;
  appliedCampaign?: {
    campaignId: string;
    campaignTitle: string;
    campaignType: 'points_free_product' | 'points_discount_product';
    discountAmount: number;
    discountPercent?: number;
    appliedQuantity: number;
    expiresAt?: string;
  };
  appliedCoupon?: {
    code: string;
    discountAmount: number;
  };
  completedBy?: {
    id: string;
    name: string;
  };
  loyaltyProcessed?: boolean;
  loyaltyPointsAwarded?: number;
  estimatedReadyTime?: string;
  actualReadyTime?: string;
}

export interface Address {
  id: string;
  title: string;
  details: string;
}

export interface PaymentMethod {
  id: string;
  type: 'card';
  last4: string;
  brand: string;
}

export interface UserSocialLinks {
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  tiktok?: string;
  youtube?: string;
}

export interface UserPrivacySettings {
  isProfilePrivate?: boolean;
  showKp?: boolean;
  showSocials?: boolean;
  showAge?: boolean;
  showGender?: boolean;
  showJoinDate?: boolean;
}

export interface PublicUserProfile {
  id: string;
  name: string;
  surname: string;
  username?: string;
  avatar?: string;
  bio?: string;
  isProfilePrivate?: boolean;
  isFollowing?: boolean;
  isFollower?: boolean;
  followersCount: number;
  followingCount: number;
  points?: number | null;
  socialLinks?: UserSocialLinks | null;
  age?: number | null;
  gender?: UserGender | null;
  createdAt?: string | null;
}

export interface User {
  id: string;
  name: string;
  surname: string;
  username?: string;
  bio?: string;
  gender?: UserGender;
  phone: string;
  email: string;
  birthDate: string;
  role: UserRole;
  accountRole?: UserRole;
  effectiveRole?: UserRole;
  sessionRole?: UserRole | null;
  balance: number;
  points: number;
  avatar: string;
  addresses?: Address[];
  paymentMethods?: PaymentMethod[];
  favorites?: string[]; // product IDs
  socialLinks?: UserSocialLinks;
  privacy?: UserPrivacySettings;
  followers?: string[]; // user IDs
  following?: string[]; // user IDs
  settings?: {
    language: 'tr' | 'en' | 'de' | 'fr' | 'es' | 'it' | 'ru';
    theme: 'light' | 'dark';
    currency?: 'TRY' | 'USD' | 'EUR' | 'GBP';
  };
  subscriptionId?: string;
  friends?: string[];
  selectedCampaign?: {
    campaignId: string;
    campaignTitle: string;
    campaignType: Campaign['type'];
    category: Campaign['category'];
    selectedAt: string;
    expiresAt: string;
    targetCategory?: string;
    targetProductId?: string;
  } | null;
  activePointReward?: {
    redemptionId: string;
    campaignId: string;
    campaignTitle: string;
    campaignType: 'points_free_product' | 'points_discount_product';
    targetCategory?: string;
    targetProductId?: string;
    targetProductName?: string;
    pointsCost: number;
    discountPercent?: number;
    usageLimit: number;
    remainingUses: number;
    redeemedAt: string;
    expiresAt: string;
    autoOrderId?: string;
  } | null;
  createdAt?: string; // ISO date
}

export interface Category {
  id: string;
  name: string;
  iconName: string;
  image?: string;
}

export interface AppState {
  currentUser: User | null;
  products: Product[];
  orders: Order[];
  notifications: Notification[];
}

export interface Notification {
  id: string;
  userId?: string; // Targeted to a specific user
  targetRole?: UserRole; // Targeted to a specific role (e.g., 'manager')
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
}

export type CampaignCategory = 'discount' | 'balance' | 'loyalty' | 'financial' | 'operational' | 'personalization';

export type CampaignType = 
  | 'discount'
  | 'balance_bonus'
  | 'point_reward'
  | 'points_free_product'
  | 'points_discount_product'
  | 'fixed_bonus'
  | 'referral'
  | 'stamp_card'
  | 'combo'
  | 'limited_stock'
  | 'happy_hour'
  | 'early_bird'
  | 'night_owl'
  | 'we_miss_you'
  | 'birthday'
  | 'vip';

export interface Campaign {
  id: string;
  title: string;
  description: string;
  category: CampaignCategory;
  type: CampaignType;
  value: number; // Percentage or fixed amount
  discountType?: 'percentage' | 'fixed';
  image?: string;
  startDate: string;
  expiryDate: string;
  active: boolean;
  
  // Specific parameters
  minLoadAmount?: number;
  minOrderAmount?: number;
  fixedGiftAmount?: number;
  requiredQuantity?: number;
  pointsCost?: number;
  usageLimit?: number;
  validityHours?: number;
  targetType?: 'all' | 'category' | 'product';
  targetCategory?: string;
  targetProductId?: string;
  comboProducts?: string[];
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  targetDays?: number;
  vipThreshold?: number;
}

export interface LoyaltyRewardCampaign {
  campaignId: string;
  campaignTitle: string;
  campaignDescription: string;
  rewardType: 'free_product' | 'discount_product';
  rewardLabel: string;
  pointsCost: number;
  remainingPoints: number;
  isEligible: boolean;
  usageLimit?: number;
  validityHours?: number;
  targetCategory?: string;
  targetProductId?: string;
  targetProductName?: string;
  discountPercent?: number;
}

export interface LoyaltySummary {
  pointsBalance: number;
  availableRewards: LoyaltyRewardCampaign[];
  activePointReward?: User['activePointReward'];
  // Damga (stamp_card) hakları — stampStatus altında taşınır.
  pointsRewardCredits?: number;
  stampStatus?: {
    campaignId: string;
    campaignTitle: string;
    requiredQuantity: number;
    currentProgress: number;
    remainingToReward: number;
    rewardCredits: number;
    targetProductId?: string;
  } | null;
}

export interface LoyaltyQrPayload {
  token: string;
  expiresAt: string;
  summary: LoyaltySummary;
}

export interface LoyaltyScanResult {
  customer: {
    id: string;
    name: string;
    email: string;
  };
  summary: LoyaltySummary;
  scannedAt: string;
}

export interface Ingredient {
  id: string;
  name: string;
  iconName: string;
}

export interface ChangeLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface BalanceTopUp {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  creditedAmount: number;
  bonusAmount: number;
  timestamp: string;
}

export interface StaffMember {
  id: string;
  name: string;
  surname: string;
  email: string;
  role: 'staff' | 'manager';
  status: 'Vardiyada' | 'İzinli';
}

export interface Review {
  id: string;
  orderId: string;
  userId: string;
  userName: string;
  productId: string;
  productName: string;
  rating: number;
  comment?: string;
  staffRating?: number;
  staffComment?: string;
  response?: string;
  respondedBy?: string;
  respondedAt?: string;
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  title: string;
  description?: string;
  type: 'percentage' | 'fixed' | 'free_delivery';
  value: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usedCount?: number;
  validFrom: string;
  validUntil: string;
  active: boolean;
  targetCategory?: string;
  targetProductId?: string;
  newUsersOnly?: boolean;
  usedBy?: string[];
}

export interface Friend {
  id: string;
  userId: string;
  friendId: string;
  status: 'pending' | 'accepted' | 'rejected';
  requestedBy: string;
  requestedAt: string;
  respondedAt?: string;
}

export interface Gift {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  type: 'balance' | 'product';
  amount?: number;
  productId?: string;
  productName?: string;
  message?: string;
  status: 'pending' | 'claimed' | 'expired';
  sentAt: string;
  claimedAt?: string;
  expiresAt: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration: 'monthly' | 'yearly';
  benefits: string[];
  discountPercent?: number;
  freeDelivery?: boolean;
  priorityQueue?: boolean;
  exclusiveProducts?: boolean;
  active: boolean;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  planName: string;
  status: 'active' | 'cancelled' | 'expired';
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  cancelledAt?: string;
}

export interface ChatMessage {
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  message: string;
  timestamp: string;
  attachments?: string[];
}

export interface ChatRoom {
  id: string;
  customerId: string;
  customerName: string;
  status: 'active' | 'waiting' | 'resolved';
  assignedTo?: string;
  assignedToName?: string;
  messages: ChatMessage[];
  lastMessageAt: string;
  closedAt?: string;
  createdAt: string;
}

export interface Reservation {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  tableNumber: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  guestCount: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'no_show' | 'completed';
  note?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancelReason?: string;
  createdAt: string;
}

export interface WaiterCall {
  id: string;
  tableNumber: string;
  tableSessionToken?: string;
  userId: string;
  userName: string;
  type: 'bill' | 'help' | 'complaint' | 'order';
  message?: string;
  priority: 'normal' | 'urgent';
  status: 'pending' | 'acknowledged' | 'completed' | 'cancelled';
  createdAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  completedBy?: string;
  completedAt?: string;
  response?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  minStock?: number;
  maxStock?: number;
  reorderPoint?: number;
  costPerUnit?: number;
  supplier?: string;
  category?: string;
  movements?: StockMovement[];
  lastRestocked?: string;
  createdAt: string;
}

export interface StockMovement {
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason?: string;
  performedBy: string;
  performedByName: string;
  timestamp: string;
}
