export type AccountRole = 'buyer' | 'seller' | 'admin';
export type ListingType = 'product' | 'service';
export type SubscriptionStatus = 'pending_verification' | 'pending' | 'approved' | 'declined' | 'expired' | 'cancelled';
export type SubscriptionRequestType = 'new' | 'renewal';
export type Category = 'Clothing' | 'Shoes' | 'Bags' | 'Jewellery' | 'Beauty' | 'Tailoring' | 'Accessories' | 'Pet Fashion (PAW)' | 'Other';

export interface Country {
  code: string;
  name: string;
  currency: string;
  cities: string[];
  paymentInstructions?: string;
}

export interface Listing {
  id: string;
  shopId: string;
  shopName: string;
  name: string;
  category: Category;
  type: ListingType;
  description: string;
  price: number;
  currency: string;
  countryCode: string;
  countryName: string;
  city: string;
  image: string;
  images?: string[];
  sizes?: string;
  colour?: string;
  serviceDetails?: string;
  enquiryLabel?: string;
  sellerWhatsapp?: string;
  isActive?: boolean;
  promotion?: 'featured' | 'sponsored';
  promotionLabel?: 'Featured' | 'Sponsored';
  isFlashSale?: boolean;
  flashSaleExpiry?: string;
  viewsCount?: number;
  wishlistSavesCount?: number;
  offersCount?: number;
  isThrift?: boolean;
  isSquadBuy?: boolean;
  isNewArrival?: boolean;
  isLayawayEligible?: boolean;
  shoeSizeEU?: string;
  shoeSizeUK?: string;
  shoeCondition?: string;
  materialType?: string;
  caseSizeMM?: string;
  watchMovement?: string;
  waterResistance?: boolean;
  capacityInfo?: string;
  fragranceNotes?: string;
  scentLongevity?: string;
  isTesterDecant?: boolean;
  isSeed: boolean;
}

export interface Shop {
  id: string;
  name: string;
  story: string;
  tagline: string;
  categories: Category[];
  sellType: 'products' | 'services' | 'both';
  countryCode: string;
  countryName: string;
  city: string;
  accent: string;
  whatsappNumber?: string;
  logoUrl?: string;
  coverUrl?: string;
  isVerified?: boolean;
  operatingHours?: string;
  arcadeName?: string;
  floorNumber?: string;
  shopNumber?: string;
  arcadeRank?: number;
  isFollowed?: boolean;
  isSeed: boolean;
  subscriptionStatus?: SubscriptionStatus;
  promotionLabel?: 'Featured' | 'Sponsored';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: AccountRole;
  countryCode?: string;
}

export interface Session {
  user: User;
  accessToken?: string;
}

export interface SubscriptionPlan {
  id: string;
  name?: string;
  payerTypes: Array<AccountRole | 'both'> | 'awaiting confirmation';
  priceLabel: string;
  renewalPeriod: string;
  currency?: string;
  amount?: number;
  targetRoles?: AccountRole[];
  countryPrices?: Record<string, { amount: number; currency: string } | null>;
  benefits?: string[];
  promotionLabel?: 'Featured' | 'Sponsored';
  isSeed?: boolean;
  accessLabel?: 'full storefronts' | 'standard storefront';
}

export interface SubscriptionRecord {
  id: string;
  shopId?: string;
  userId?: string;
  planId?: string;
  planName?: string;
  requestType?: SubscriptionRequestType;
  countryCode: string;
  payerType: AccountRole;
  transactionReference: string;
  receiptUrl?: string;
  status: SubscriptionStatus;
  submittedAt: string;
  renewalDate?: string;
  expiresAt?: string;
  paymentStatus?: 'pending' | 'verified' | 'declined' | 'expired' | 'cancelled';
  reviewedAt?: string;
  reviewerNote?: string;
}

export interface Enquiry {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  message: string;
  reply?: string;
  status: 'submitted' | 'responded' | 'closed';
  createdAt: string;
}

export interface EnquiryMessage {
  id: string;
  enquiryId: string;
  senderId: string;
  senderRole: 'buyer' | 'seller';
  body: string;
  createdAt: string;
}

export interface Order {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  shopId?: string;
  quantity?: number;
  unitPrice?: number;
  currency?: string;
  status: 'submitted' | 'accepted' | 'ready_for_pickup' | 'in_delivery' | 'completed' | 'cancelled';
  orderStatus?: 'ORDER_RECEIVED' | 'CONFIRMED_BY_SHOP' | 'OUT_FOR_DELIVERY' | 'DELIVERED_COMPLETED';
  fulfillment: 'pickup' | 'delivery';
  fulfillmentDetails?: string;
  buyerMessage?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  kind: 'subscription' | 'enquiry' | 'order' | 'shop' | 'system';
  readAt?: string;
  createdAt: string;
  href?: string;
}

export interface Review {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  rating: number;
  body: string;
  createdAt: string;
}

export interface SubscriptionAccessRules {
  requiredRoles: AccountRole[];
}

export interface AdminSettings {
  plans: SubscriptionPlan[];
  countries: Country[];
  subscriptionAccess: SubscriptionAccessRules;
}

export interface AccountSettings {
  name: string;
  email: string;
  countryCode: string;
  city?: string;
  notificationPreferences: Record<string, boolean>;
  avatarUrl?: string;
}

export interface SubscriptionAccess {
  requiredRoles: AccountRole[];
  activeRecord?: SubscriptionRecord;
  status: 'active' | 'pending' | 'inactive' | 'not_required';
}

export interface OrderCreateInput {
  listingId: string;
  quantity: number;
  fulfillment: 'pickup' | 'delivery';
  fulfillmentDetails: string;
  buyerMessage?: string;
}

export interface OrderStatusUpdate {
  status: Order['status'];
  note?: string;
}

export interface MarketplaceReport {
  generatedAt: string;
  total: number;
  active: number;
  pending: number;
  flagged: number;
}

export interface SafetyReport {
  id: string;
  reporterId: string;
  listingId?: string;
  reportedUserId?: string;
  reason: 'counterfeit' | 'spam' | 'harassment' | 'misleading' | 'other';
  details: string;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  createdAt: string;
  reviewedAt?: string;
}

export interface ApiErrorShape {
  code: 'not-connected' | 'unauthorized' | 'forbidden' | 'not-found' | 'validation' | 'server';
  message: string;
  details?: Record<string, string>;
}

export interface AdminMapNode {
  id: string;
  name: string;
  city: string;
  countryCode: string;
  isVerified: boolean;
  categories: Category[];
  sellType: string;
  lat: number;
  lng: number;
  status: string;
}

export interface PromotionAd {
  id: string;
  title: string;
  type: 'featured' | 'sponsored' | 'banner';
  status: 'active' | 'paused' | 'expired';
  budget: string;
  expiresAt: string;
}

export interface PlatformAnalytics {
  totalUsers: number;
  totalShops: number;
  verifiedShops: number;
  activeListings: number;
  completedOrders: number;
  monthlyVolumeUgx: number;
}

