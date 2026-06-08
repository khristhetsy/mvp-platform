create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key,
  full_name text,
  email text,
  role text default 'founder',
  created_at timestamp default now()
);

create table companies (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid references profiles(id),
  company_name text not null,
  industry text,
  country text,
  state text,
  business_description text,
  funding_amount numeric,
  use_of_funds text,
  revenue_stage text,
  team_summary text,
  cap_table_summary text,
  status text default 'draft',
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id),
  uploaded_by uuid references profiles(id),
  document_type text,
  file_name text,
  file_path text,
  file_url text,
  mime_type text,
  size_bytes bigint,
  ai_summary text,
  created_at timestamp default now()
);

create table diligence_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id),
  executive_summary text,
  business_overview text,
  financial_review text,
  market_review text,
  legal_review text,
  team_review text,
  risk_flags jsonb,
  missing_documents jsonb,
  readiness_score integer,
  recommendations text,
  created_at timestamp default now()
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id),
  title text,
  slug text unique,
  problem text,
  solution text,
  market_opportunity text,
  traction text,
  funding_target numeric,
  minimum_investment numeric,
  use_of_funds text,
  risk_disclosures text,
  status text default 'draft',
  published_at timestamp,
  created_at timestamp default now()
);

create table investor_interests (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid references profiles(id),
  campaign_id uuid references campaigns(id),
  interest_amount numeric,
  message text,
  status text default 'new',
  created_at timestamp default now()
);

create table admin_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id),
  reviewed_by uuid references profiles(id),
  status text,
  notes text,
  created_at timestamp default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  action text,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamp default now()
);
