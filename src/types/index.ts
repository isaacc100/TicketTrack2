// Shared types for TicketTrack2 POS

// ─── Database Model Types ─────────────────────────────────────────────────────

export interface StaffInfo {
  id: string;
  name: string;
  rank: number;
}

export interface TableWithTabs {
  id: string;
  number: number;
  name: string | null;
  zone: string | null;
  seats: number;
  posX: number;
  posY: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'AWAITING_FOOD' | 'READY' | 'PAID' | 'RESERVED' | 'DIRTY';
  tabs: TabSummary[];
}

export interface TabSummary {
  id: string;
  tableId: string | null;
  name: string | null;
  allergens: string[] | null;
  status: 'OPEN' | 'CLOSED';
  staffId: string;
  openedAt: string;
}

export interface TabWithOrders extends TabSummary {
  table: { id: string; number: number; name: string | null } | null;
  orders: OrderWithItems[];
}

export interface OrderWithItems {
  id: string;
  tabId: string;
  orderNumber: number;
  status: OrderStatus;
  priority: boolean;
  notes: string | null;
  staffId: string;
  discountType: string | null;
  discountValue: number | null;
  subtotal: number;
  total: number;
  createdAt: string;
  submittedAt: string | null;
  items: OrderItemData[];
}

export interface OrderItemData {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  modifiers: ModifierSelection[] | null;
  notes: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'SERVED' | 'VOID';
  kdsStation: string | null;
  kdsStatus: KdsItemStatus;
  startedAt: string | null;
  completedAt: string | null;
  servedAt: string | null;
  voidReason: string | null;
  voidedBy: string | null;
}

export type KdsItemStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'SERVED';

export type OrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'CLOSED'
  | 'VOID';

// ─── Menu Types ───────────────────────────────────────────────────────────────

export interface CategoryData {
  id: string;
  name: string;
  sortOrder: number;
  colour: string | null;
  items: MenuItemData[];
}

export interface MenuItemData {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  description: string | null;
  colour: string | null;
  sortOrder: number;
  modifierGroups: ModifierGroup[] | null;
  isAvailable: boolean;
}

export interface ModifierGroup {
  name: string;
  required: boolean;
  multiSelect: boolean;
  min?: number;
  max?: number;
  options: ModifierOption[];
}

export interface ModifierOption {
  name: string;
  price: number; // additional price (0 for free mods)
}

export interface ModifierSelection {
  groupName: string;
  selections: { name: string; price: number }[];
}

// ─── Payment Types ────────────────────────────────────────────────────────────

export type PaymentMethod = 'CASH' | 'CARD' | 'OTHER';

export interface PaymentData {
  id: string;
  tabId: string;
  method: PaymentMethod;
  amount: number;
  tipAmount: number;
  changeGiven: number | null;
  staffId: string;
  processedAt: string;
}

// ─── Checkout Types ───────────────────────────────────────────────────────────

export type DiscountType = 'PERCENT' | 'FIXED';

export interface CheckoutPayload {
  method: PaymentMethod;
  amountTendered: number;
  total: number;
  tipAmount?: number;
  discountType?: DiscountType;
  discountValue?: number;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  error?: string;
  data?: T;
}

// ─── Socket Event Types ───────────────────────────────────────────────────────

export interface TableStatusEvent {
  tableId: string;
  status: string;
}

export interface TabEvent {
  tab?: TabSummary;
  tabId?: string;
}

export interface OrderEvent {
  order?: OrderWithItems;
  orderId?: string;
}

// ─── Allergen Constants ───────────────────────────────────────────────────────

export const ALLERGENS = [
  'Celery',
  'Gluten',
  'Crustaceans',
  'Eggs',
  'Fish',
  'Lupin',
  'Milk',
  'Molluscs',
  'Mustard',
  'Nuts',
  'Peanuts',
  'Sesame',
  'Soya',
  'Sulphites',
] as const;

export type Allergen = (typeof ALLERGENS)[number];

// ─── KDS Types ────────────────────────────────────────────────────────────────

export interface KdsStation {
  id: string;
  name: string;
  colour: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface KdsOrder {
  id: string;
  orderNumber: number;
  tabId: string;
  tableName: string | null;
  tableNumber: number | null;
  priority: boolean;
  allergens: string[];
  notes: string | null;
  submittedAt: string;
  items: KdsOrderItem[];
}

export interface KdsOrderItem {
  id: string;
  name: string;
  quantity: number;
  modifiers: ModifierSelection[] | null;
  notes: string | null;
  kdsStation: string | null;
  kdsStatus: KdsItemStatus;
  startedAt: string | null;
  completedAt: string | null;
}

export interface KdsItemEvent {
  itemId: string;
  orderId: string;
  kdsStatus: KdsItemStatus;
  staffId: string;
}

export interface KdsOrderEvent {
  order: KdsOrder;
}

// ─── Pickup Types ─────────────────────────────────────────────────────────────

export interface PickupOrder {
  id: string;
  orderNumber: number;
  tableName: string | null;
  tableNumber: number | null;
  priority: boolean;
  completedAt: string;
  items: PickupItem[];
}

export interface PickupItem {
  id: string;
  name: string;
  quantity: number;
  modifiers: ModifierSelection[] | null;
  kdsStatus: KdsItemStatus;
  completedAt: string | null;
  servedAt: string | null;
}
