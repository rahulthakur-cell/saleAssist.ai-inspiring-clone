// ============================================================
// Permission Constants
// ============================================================

export const PERMISSIONS = {
  // Video Calls
  VIDEO_CALL_CREATE: 'video_call:create',
  VIDEO_CALL_JOIN: 'video_call:join',
  VIDEO_CALL_VIEW: 'video_call:view',
  VIDEO_CALL_DELETE: 'video_call:delete',

  // Live Streams
  LIVE_STREAM_CREATE: 'live_stream:create',
  LIVE_STREAM_MANAGE: 'live_stream:manage',
  LIVE_STREAM_VIEW: 'live_stream:view',

  // Shoppable Videos
  SHOPPABLE_VIDEO_CREATE: 'shoppable_video:create',
  SHOPPABLE_VIDEO_EDIT: 'shoppable_video:edit',
  SHOPPABLE_VIDEO_VIEW: 'shoppable_video:view',
  SHOPPABLE_VIDEO_DELETE: 'shoppable_video:delete',

  // Video FAQ
  VIDEO_FAQ_CREATE: 'video_faq:create',
  VIDEO_FAQ_EDIT: 'video_faq:edit',
  VIDEO_FAQ_VIEW: 'video_faq:view',
  VIDEO_FAQ_DELETE: 'video_faq:delete',

  // AI Chat
  AI_CHAT_USE: 'ai_chat:use',
  AI_CHAT_CONFIG: 'ai_chat:config',

  // CRM
  CONTACT_CREATE: 'contact:create',
  CONTACT_VIEW: 'contact:view',
  CONTACT_EDIT: 'contact:edit',
  CONTACT_DELETE: 'contact:delete',
  COMPANY_CREATE: 'company:create',
  COMPANY_VIEW: 'company:view',
  COMPANY_EDIT: 'company:edit',
  COMPANY_DELETE: 'company:delete',
  DEAL_CREATE: 'deal:create',
  DEAL_VIEW: 'deal:view',
  DEAL_EDIT: 'deal:edit',
  DEAL_DELETE: 'deal:delete',

  // Leads
  LEAD_CREATE: 'lead:create',
  LEAD_VIEW: 'lead:view',
  LEAD_EDIT: 'lead:edit',
  LEAD_ASSIGN: 'lead:assign',
  LEAD_DELETE: 'lead:delete',

  // Analytics
  ANALYTICS_VIEW: 'analytics:view',

  // Team
  TEAM_VIEW: 'team:view',
  TEAM_MANAGE: 'team:manage',
  ROLE_MANAGE: 'role:manage',

  // Billing
  BILLING_VIEW: 'billing:view',
  BILLING_MANAGE: 'billing:manage',

  // Settings
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_MANAGE: 'settings:manage',
  WIDGET_MANAGE: 'widget:manage',
  API_KEY_MANAGE: 'api_key:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Default permissions per role
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  TENANT_OWNER: Object.values(PERMISSIONS),
  ADMIN: Object.values(PERMISSIONS),
  MANAGER: [
    PERMISSIONS.VIDEO_CALL_CREATE,
    PERMISSIONS.VIDEO_CALL_JOIN,
    PERMISSIONS.VIDEO_CALL_VIEW,
    PERMISSIONS.LIVE_STREAM_CREATE,
    PERMISSIONS.LIVE_STREAM_MANAGE,
    PERMISSIONS.LIVE_STREAM_VIEW,
    PERMISSIONS.SHOPPABLE_VIDEO_CREATE,
    PERMISSIONS.SHOPPABLE_VIDEO_EDIT,
    PERMISSIONS.SHOPPABLE_VIDEO_VIEW,
    PERMISSIONS.VIDEO_FAQ_CREATE,
    PERMISSIONS.VIDEO_FAQ_EDIT,
    PERMISSIONS.VIDEO_FAQ_VIEW,
    PERMISSIONS.AI_CHAT_USE,
    PERMISSIONS.CONTACT_CREATE,
    PERMISSIONS.CONTACT_VIEW,
    PERMISSIONS.CONTACT_EDIT,
    PERMISSIONS.COMPANY_VIEW,
    PERMISSIONS.DEAL_CREATE,
    PERMISSIONS.DEAL_VIEW,
    PERMISSIONS.DEAL_EDIT,
    PERMISSIONS.LEAD_CREATE,
    PERMISSIONS.LEAD_VIEW,
    PERMISSIONS.LEAD_EDIT,
    PERMISSIONS.LEAD_ASSIGN,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
  ],
  AGENT: [
    PERMISSIONS.VIDEO_CALL_CREATE,
    PERMISSIONS.VIDEO_CALL_JOIN,
    PERMISSIONS.VIDEO_CALL_VIEW,
    PERMISSIONS.LIVE_STREAM_VIEW,
    PERMISSIONS.SHOPPABLE_VIDEO_VIEW,
    PERMISSIONS.VIDEO_FAQ_VIEW,
    PERMISSIONS.AI_CHAT_USE,
    PERMISSIONS.CONTACT_CREATE,
    PERMISSIONS.CONTACT_VIEW,
    PERMISSIONS.CONTACT_EDIT,
    PERMISSIONS.COMPANY_VIEW,
    PERMISSIONS.DEAL_VIEW,
    PERMISSIONS.LEAD_CREATE,
    PERMISSIONS.LEAD_VIEW,
    PERMISSIONS.LEAD_EDIT,
    PERMISSIONS.ANALYTICS_VIEW,
  ],
  VIEWER: [
    PERMISSIONS.VIDEO_CALL_VIEW,
    PERMISSIONS.LIVE_STREAM_VIEW,
    PERMISSIONS.SHOPPABLE_VIDEO_VIEW,
    PERMISSIONS.VIDEO_FAQ_VIEW,
    PERMISSIONS.CONTACT_VIEW,
    PERMISSIONS.COMPANY_VIEW,
    PERMISSIONS.DEAL_VIEW,
    PERMISSIONS.LEAD_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
  ],
};

// ============================================================
// API Constants
// ============================================================

export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

// ============================================================
// Redis Key Patterns
// ============================================================

export const REDIS_KEYS = {
  tenant: (id: string) => `tenant:${id}`,
  userPermissions: (userId: string, tenantId: string) => `user:${userId}:perms:${tenantId}`,
  widgetConfig: (apiKey: string) => `widget:${apiKey}`,
  availableAgents: (tenantId: string) => `agents:available:${tenantId}`,
  callQueue: (tenantId: string) => `call:queue:${tenantId}`,
  activeVisitors: (tenantId: string) => `visitors:active:${tenantId}`,
  rateLimit: (key: string) => `rate_limit:${key}`,
  session: (sessionId: string) => `session:${sessionId}`,
};

// ============================================================
// BullMQ Queue Names
// ============================================================

export const QUEUES = {
  VIDEO_TRANSCODE: 'video-transcode',
  EMAIL: 'email',
  ANALYTICS_SYNC: 'analytics-sync',
  SEARCH_INDEX: 'search-index',
  BILLING_SYNC: 'billing-sync',
  NOTIFICATION: 'notification',
};
