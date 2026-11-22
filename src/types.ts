export interface SiteSettings {
  brandName: string;
  tagline: string;
  announcementEnabled: boolean;
  announcementText: string;
  heroKicker: string;
  heroHeadline: string;
  heroSubheadline: string;
  heroPrimaryCta: string;
  heroSecondaryCta: string;
  heroImage: string;
  currencySymbol: string;
  currencyCode: string;
  stat1Value: string;
  stat1Label: string;
  stat2Value: string;
  stat2Label: string;
  stat3Value: string;
  stat3Label: string;
  stat4Value: string;
  stat4Label: string;
  catalogTitle: string;
  catalogSubtitle: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  socialTwitter: string;
  socialInstagram: string;
  socialLinkedin: string;
  socialGithub: string;
  socialYoutube: string;
  copyrightText: string;
  termsUpdatedAt: string;
  termsContent: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
}

export interface Product {
  id: string;
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  price: number;
  compare_at_price: number;
  commercial_price: number;
  category_id: string;
  category_name?: string;
  category_slug?: string;
  image_url: string;
  file_format: string;
  file_size: string;
  version: string;
  preview_url: string;
  download_notes: string;
  highlights: string[];
  featured: boolean;
  published: boolean;
  sales_count: number;
  review_count: number;
  avg_rating: number;
  created_at: string;
}

export type UserGender = 'male' | 'female';
export type OtpChannel = 'whatsapp' | 'gmail' | 'mobile';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'customer';
  phone: string;
  gender: UserGender;
  avatar_url: string;
  company: string;
  billing_address: string;
  bio: string;
  push_enabled: number;
  created_at: string;
}

export interface CartItem {
  productId: string;
  licenseType: 'Personal' | 'Commercial';
  quantity: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_title: string;
  product_image: string;
  file_format: string;
  version: string;
  license_type: 'Personal' | 'Commercial';
  unit_price: number;
  quantity: number;
  license_key: string;
}

export type OrderStatus = 'Pending' | 'Confirmed' | 'Processing' | 'Delivered' | 'Cancelled' | 'Refunded';

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  billing_address: string;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  status: OrderStatus;
  status_note: string;
  payment_method: string;
  payment_mode: 'live' | 'sandbox';
  razorpay_order_id: string;
  razorpay_payment_id: string;
  payment_verified: boolean;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

export interface Review {
  id: string;
  product_id: string;
  product_title?: string;
  user_id: string;
  user_name: string;
  rating: number;
  title: string;
  comment: string;
  verified_purchase: boolean;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  order_id: string;
  read: boolean;
  created_at: string;
}

export interface EmailConfirmationLog {
  id: string;
  orderId: string;
  orderNumber: string;
  recipientEmail: string;
  recipientName: string;
  senderEmail: string;
  subject: string;
  previewText: string;
  totalAmount: number;
  currencySymbol: string;
  paymentReference: string;
  sentAt: string;
  status: 'Sent';
  items: Array<{
    title: string;
    licenseType: string;
    quantity: number;
    licenseKey: string;
    unitPrice: number;
  }>;
}

export interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string;
  company: string;
  created_at: string;
  order_count: number;
  total_spent: number;
}

export type AppView =
  | { page: 'home' }
  | { page: 'categories'; categoryId?: string }
  | { page: 'product'; productId: string }
  | { page: 'dashboard'; tab?: 'library' | 'tracking' | 'history' | 'profile'; highlightOrderId?: string }
  | { page: 'admin'; tab?: 'orders' | 'products' | 'categories' | 'cms' | 'reviews' | 'footer' }
  | { page: 'terms' };

export const STUDIO_IMAGE_PRESETS = [
  { label: 'Architectural Studio Desk (Hero)', url: '/src/assets/images/hero_digital_studio_1795268985581.jpg' },
  { label: 'Strata UI System Display', url: '/src/assets/images/product_ui_system_1795268973060.jpg' },
  { label: 'SaaS Code Starter Kit', url: '/src/assets/images/product_code_starter_1795268991031.jpg' },
  { label: 'Minimalist Workspace OS', url: '/src/assets/images/product_notion_os_1795268981946.jpg' },
  { label: 'Grid & Typography Monograph', url: '/src/assets/images/product_brand_ebook_1795268972411.jpg' },
  { label: 'Geometric Icon Foundry', url: '/src/assets/images/product_icon_foundry_1795268982392.jpg' }
];
