-- ============================================================
-- SaleAssist.ai Clone — PostgreSQL Initialization
-- Executed on first container startup
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Row-Level Security (RLS) Helper Function
-- Sets the current tenant context for RLS policies
-- ============================================================

-- Function to get current tenant ID from session config
CREATE OR REPLACE FUNCTION current_tenant_id() 
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- Performance: Create indexes for common query patterns
-- (Prisma handles most indexes, but these are supplementary)
-- ============================================================

-- Note: RLS policies will be created after Prisma migration
-- since tables don't exist yet. See: packages/database/prisma/rls-setup.sql
