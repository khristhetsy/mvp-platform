export type UserRole = "founder" | "investor" | "admin" | "analyst";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  created_at: string;
};

export type ReviewStatus = "pending" | "approved" | "rejected" | "changes_requested";

export type Company = {
  id: string;
  founder_id: string;
  company_name: string;
  industry: string | null;
  country: string | null;
  state: string | null;
  business_description: string | null;
  website?: string | null;
  logo_url?: string | null;
  funding_amount: number | null;
  use_of_funds: string | null;
  revenue_stage: string | null;
  team_summary: string | null;
  cap_table_summary: string | null;
  status: string | null;
  review_status: ReviewStatus | string | null;
  approved_at: string | null;
  approved_by: string | null;
  is_published: boolean;
  marketplace_visible: boolean;
  published_at: string | null;
  slug: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentRecord = {
  id: string;
  company_id: string;
  uploaded_by: string;
  document_type: string | null;
  file_name: string | null;
  file_path: string | null;
  file_url: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  ai_summary: string | null;
  status: string | null;
  is_approved: boolean;
  created_at: string;
};

export type CompanyMember = {
  id: string;
  company_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  created_at: string;
};

export type Campaign = {
  id: string;
  company_id: string;
  title: string | null;
  slug: string | null;
  problem: string | null;
  solution: string | null;
  market_opportunity: string | null;
  traction: string | null;
  funding_target: number | null;
  minimum_investment: number | null;
  use_of_funds: string | null;
  risk_disclosures: string | null;
  status: string | null;
  published_at: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & Pick<Profile, "id">;
        Update: Partial<Profile>;
        Relationships: [];
      };
      companies: {
        Row: Company;
        Insert: Omit<Partial<Company>, "id" | "created_at" | "updated_at"> & Pick<Company, "company_name" | "founder_id">;
        Update: Partial<Company>;
        Relationships: [];
      };
      company_members: {
        Row: CompanyMember;
        Insert: Pick<CompanyMember, "company_id" | "user_id"> & Partial<Pick<CompanyMember, "role">>;
        Update: Partial<Pick<CompanyMember, "role">>;
        Relationships: [];
      };
      documents: {
        Row: DocumentRecord;
        Insert: Omit<Partial<DocumentRecord>, "id" | "created_at"> &
          Pick<DocumentRecord, "company_id" | "uploaded_by">;
        Update: Partial<DocumentRecord>;
        Relationships: [];
      };
      diligence_reports: {
        Row: {
          id: string;
          company_id: string;
          executive_summary: string | null;
          business_overview: string | null;
          financial_review: string | null;
          market_review: string | null;
          legal_review: string | null;
          team_review: string | null;
          risk_flags: unknown;
          missing_documents: unknown;
          readiness_score: number | null;
          recommendations: string | null;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      campaigns: {
        Row: Campaign;
        Insert: Omit<Partial<Campaign>, "id" | "created_at"> & Pick<Campaign, "company_id">;
        Update: Partial<Campaign>;
        Relationships: [];
      };
      investor_interests: {
        Row: {
          id: string;
          investor_id: string;
          company_id: string | null;
          campaign_id: string;
          interest_amount: number | null;
          message: string | null;
          status: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          investor_id: string;
          company_id?: string | null;
          campaign_id: string;
          interest_amount?: number | null;
          message?: string | null;
          status?: string | null;
        };
        Update: {
          company_id?: string | null;
          campaign_id?: string | null;
          interest_amount?: number | null;
          message?: string | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      intro_requests: {
        Row: {
          id: string;
          investor_id: string;
          company_id: string;
          campaign_id: string | null;
          message: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          investor_id: string;
          company_id: string;
          campaign_id?: string | null;
          message?: string | null;
          status?: string;
        };
        Update: {
          status?: string;
          message?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      saved_deals: {
        Row: {
          id: string;
          investor_id: string;
          company_id: string;
          campaign_id: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          investor_id: string;
          company_id: string;
          campaign_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      admin_reviews: {
        Row: {
          id: string;
          company_id: string;
          founder_id: string | null;
          reviewed_by: string | null;
          status: string | null;
          notes: string | null;
          feedback: string | null;
          requested_changes: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          company_id: string;
          founder_id?: string | null;
          reviewed_by?: string | null;
          status?: string | null;
          notes?: string | null;
          feedback?: string | null;
          requested_changes?: string | null;
        };
        Update: {
          status?: string | null;
          notes?: string | null;
          feedback?: string | null;
          requested_changes?: string | null;
          reviewed_by?: string | null;
          founder_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: Record<string, unknown>;
        Insert: {
          user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          metadata?: Record<string, unknown> | null;
        };
        Update: never;
        Relationships: [];
      };
      investor_activity: {
        Row: {
          id: string;
          investor_id: string;
          company_id: string;
          campaign_id: string | null;
          activity_type: string;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          investor_id: string;
          company_id: string;
          campaign_id?: string | null;
          activity_type: string;
          metadata?: Record<string, unknown>;
        };
        Update: never;
        Relationships: [];
      };
      investor_pipeline: {
        Row: {
          id: string;
          investor_id: string;
          company_id: string;
          campaign_id: string | null;
          stage: string;
          probability: number;
          owner_admin_id: string | null;
          last_activity_at: string;
          last_contacted_at: string | null;
          next_follow_up_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          investor_id: string;
          company_id: string;
          campaign_id?: string | null;
          stage?: string;
          probability?: number;
          owner_admin_id?: string | null;
          last_activity_at?: string;
          last_contacted_at?: string | null;
          next_follow_up_at?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          campaign_id?: string | null;
          stage?: string;
          probability?: number;
          owner_admin_id?: string | null;
          last_activity_at?: string;
          last_contacted_at?: string | null;
          next_follow_up_at?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
