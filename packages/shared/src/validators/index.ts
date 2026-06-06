import { z } from 'zod';

// ============================================================
// Auth Validators
// ============================================================

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  tenantSlug: z.string().optional(),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  tenantName: z.string().min(2, 'Organization name must be at least 2 characters').max(100),
  tenantSlug: z
    .string()
    .min(3, 'Slug must be at least 3 characters')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
    .optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

// ============================================================
// Tenant Validators
// ============================================================

export const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  logo: z.string().url().optional().nullable(),
  settings: z
    .object({
      timezone: z.string().optional(),
      currency: z.string().length(3).optional(),
      language: z.string().length(2).optional(),
    })
    .optional(),
});

// ============================================================
// Team Validators
// ============================================================

export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['ADMIN', 'MANAGER', 'AGENT', 'VIEWER']),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'AGENT', 'VIEWER']),
  customRoleId: z.string().uuid().optional().nullable(),
});

// ============================================================
// CRM Validators
// ============================================================

export const createContactSchema = z.object({
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional().nullable(),
  title: z.string().max(100).optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  source: z.enum(['VIDEO_CALL', 'LIVE_STREAM', 'AI_CHAT', 'SHOPPABLE_VIDEO', 'WIDGET', 'MANUAL', 'IMPORT']).optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional(),
});

export const createDealSchema = z.object({
  title: z.string().min(1).max(200),
  value: z.number().positive().optional().nullable(),
  currency: z.string().length(3).default('USD'),
  stage: z.enum(['PROSPECTING', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST']).optional(),
  probability: z.number().min(0).max(100).optional(),
  expectedCloseAt: z.string().datetime().optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  customFields: z.record(z.unknown()).optional(),
});

export const createLeadSchema = z.object({
  name: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  company: z.string().max(100).optional(),
  message: z.string().max(2000).optional(),
  source: z.enum(['VIDEO_CALL', 'LIVE_STREAM', 'AI_CHAT', 'SHOPPABLE_VIDEO', 'WIDGET', 'MANUAL', 'IMPORT']),
});

// ============================================================
// Video Validators
// ============================================================

export const createVideoCallSchema = z.object({
  type: z.enum(['INBOUND', 'OUTBOUND', 'SCHEDULED']).default('INBOUND'),
  scheduledAt: z.string().datetime().optional(),
  visitorName: z.string().max(100).optional(),
  visitorEmail: z.string().email().optional(),
  visitorPhone: z.string().max(20).optional(),
  routingMethod: z.string().optional(),
});

export const createLiveStreamSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  scheduledAt: z.string().datetime().optional(),
  isShoppable: z.boolean().default(false),
  allowChat: z.boolean().default(true),
  maxViewers: z.number().positive().optional(),
});

export const createShoppableVideoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  displayType: z.enum(['carousel', 'hero', 'story', 'grid']).default('carousel'),
  autoplay: z.boolean().default(false),
  loop: z.boolean().default(true),
  muted: z.boolean().default(true),
});

export const createHotspotSchema = z.object({
  productName: z.string().min(1).max(200),
  productUrl: z.string().url(),
  productImage: z.string().url().optional(),
  price: z.number().positive().optional(),
  currency: z.string().length(3).default('USD'),
  startTime: z.number().min(0),
  endTime: z.number().min(0),
  posX: z.number().min(0).max(100).optional(),
  posY: z.number().min(0).max(100).optional(),
  width: z.number().min(0).max(100).optional(),
  height: z.number().min(0).max(100).optional(),
});

// ============================================================
// Widget Validators
// ============================================================

export const updateWidgetConfigSchema = z.object({
  name: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
  position: z.enum(['BOTTOM_RIGHT', 'BOTTOM_LEFT', 'TOP_RIGHT', 'TOP_LEFT']).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  borderRadius: z.number().min(0).max(32).optional(),
  greeting: z.string().max(200).optional(),
  enableVideoCall: z.boolean().optional(),
  enableChat: z.boolean().optional(),
  enableShoppable: z.boolean().optional(),
  enableFaq: z.boolean().optional(),
  allowedDomains: z.array(z.string()).optional(),
});

// ============================================================
// Pagination & Filtering
// ============================================================

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
