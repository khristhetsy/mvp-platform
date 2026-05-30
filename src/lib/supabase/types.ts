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
  founder_goals?: string | null;
  onboarding_progress_percent?: number;
  onboarding_completed_at?: string | null;
  onboarding_step_state?: Record<string, unknown> | null;
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

export type Subscription = {
  id: string;
  profile_id: string;
  role: string;
  plan_type: string;
  subscription_status: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  monthly_price_cents: number;
  currency: string;
  created_at: string;
  updated_at: string;
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
      subscriptions: {
        Row: Subscription;
        Insert: Omit<Partial<Subscription>, "id" | "created_at" | "updated_at"> &
          Pick<Subscription, "profile_id" | "role" | "plan_type" | "subscription_status">;
        Update: Partial<Omit<Subscription, "id" | "profile_id" | "created_at">>;
        Relationships: [];
      };
      upgrade_requests: {
        Row: {
          id: string;
          profile_id: string;
          request_type: string;
          requested_plan: string | null;
          feature_key: string | null;
          status: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          profile_id: string;
          request_type: string;
          requested_plan?: string | null;
          feature_key?: string | null;
          status?: string;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          status?: string;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: DocumentRecord;
        Insert: Omit<Partial<DocumentRecord>, "id" | "created_at"> &
          Pick<DocumentRecord, "company_id" | "uploaded_by">;
        Update: Partial<DocumentRecord>;
        Relationships: [];
      };
      learning_modules: {
        Row: {
          id: string;
          slug: string;
          title: string;
          category: string;
          description: string;
          estimated_time_minutes: number;
          difficulty: string;
          related_remediation_category: string | null;
          required_plan: string;
          readiness_stage: string;
          order_index: number;
          is_published: boolean;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      learning_progress: {
        Row: {
          id: string;
          founder_id: string;
          company_id: string;
          module_id: string;
          status: string;
          percent_complete: number;
          started_at: string | null;
          completed_at: string | null;
          last_viewed_at: string | null;
        };
        Insert: {
          founder_id: string;
          company_id: string;
          module_id: string;
          status?: string;
          percent_complete?: number;
          started_at?: string | null;
          completed_at?: string | null;
          last_viewed_at?: string | null;
        };
        Update: {
          status?: string;
          percent_complete?: number;
          started_at?: string | null;
          completed_at?: string | null;
          last_viewed_at?: string | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          recipient_user_id: string;
          actor_user_id: string | null;
          type: string;
          title: string;
          message: string;
          entity_type: string | null;
          entity_id: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          recipient_user_id: string;
          actor_user_id?: string | null;
          type: string;
          title: string;
          message: string;
          entity_type?: string | null;
          entity_id?: string | null;
          is_read?: boolean;
        };
        Update: {
          is_read?: boolean;
        };
        Relationships: [];
      };
      connected_accounts: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          provider_user_id: string;
          access_token_encrypted: string;
          refresh_token_encrypted: string | null;
          token_expires_at: string | null;
          scopes: string[];
          email: string | null;
          connected_at: string;
          updated_at: string;
          last_refresh_at: string | null;
        };
        Insert: {
          user_id: string;
          provider: string;
          provider_user_id: string;
          access_token_encrypted: string;
          refresh_token_encrypted?: string | null;
          token_expires_at?: string | null;
          scopes?: string[];
          email?: string | null;
          connected_at?: string;
          updated_at?: string;
          last_refresh_at?: string | null;
        };
        Update: {
          provider_user_id?: string;
          access_token_encrypted?: string;
          refresh_token_encrypted?: string | null;
          token_expires_at?: string | null;
          scopes?: string[];
          email?: string | null;
          updated_at?: string;
          last_refresh_at?: string | null;
        };
        Relationships: [];
      };
      message_threads: {
        Row: {
          id: string;
          company_id: string;
          founder_id: string;
          investor_id: string;
          intro_request_id: string | null;
          status: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          founder_id: string;
          investor_id: string;
          intro_request_id?: string | null;
          status?: string;
          created_by: string;
          updated_at?: string;
        };
        Update: {
          status?: string;
          intro_request_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      thread_messages: {
        Row: {
          id: string;
          thread_id: string;
          sender_id: string;
          body: string;
          message_type: string;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          thread_id: string;
          sender_id: string;
          body: string;
          message_type?: string;
          read_at?: string | null;
        };
        Update: {
          read_at?: string | null;
        };
        Relationships: [];
      };
      thread_meetings: {
        Row: {
          id: string;
          thread_id: string;
          company_id: string;
          founder_id: string;
          investor_id: string;
          requested_by: string;
          status: string;
          proposed_start_time: string | null;
          proposed_end_time: string | null;
          timezone: string | null;
          meeting_title: string | null;
          meeting_notes: string | null;
          external_calendar_provider: string | null;
          external_calendar_event_id: string | null;
          external_meet_url: string | null;
          calendar_host_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          thread_id: string;
          company_id: string;
          founder_id: string;
          investor_id: string;
          requested_by: string;
          status?: string;
          proposed_start_time?: string | null;
          proposed_end_time?: string | null;
          timezone?: string | null;
          meeting_title?: string | null;
          meeting_notes?: string | null;
          external_calendar_provider?: string | null;
          external_calendar_event_id?: string | null;
          external_meet_url?: string | null;
          calendar_host_user_id?: string | null;
          updated_at?: string;
        };
        Update: {
          status?: string;
          proposed_start_time?: string | null;
          proposed_end_time?: string | null;
          timezone?: string | null;
          meeting_title?: string | null;
          meeting_notes?: string | null;
          external_calendar_provider?: string | null;
          external_calendar_event_id?: string | null;
          external_meet_url?: string | null;
          calendar_host_user_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      investor_profiles: {
        Row: {
          id: string;
          profile_id: string;
          investor_type: string | null;
          firm_name: string | null;
          check_size_min: number | null;
          check_size_max: number | null;
          preferred_sectors: string[];
          preferred_geographies: string[];
          preferred_stages: string[];
          accredited_status: boolean;
          investment_thesis: string | null;
          contact_preference: string | null;
          approval_status: string;
          admin_feedback: string | null;
          submitted_at: string | null;
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          profile_id: string;
          investor_type?: string | null;
          firm_name?: string | null;
          check_size_min?: number | null;
          check_size_max?: number | null;
          preferred_sectors?: string[];
          preferred_geographies?: string[];
          preferred_stages?: string[];
          accredited_status?: boolean;
          investment_thesis?: string | null;
          contact_preference?: string | null;
          approval_status?: string;
          admin_feedback?: string | null;
          submitted_at?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          updated_at?: string;
        };
        Update: {
          investor_type?: string | null;
          firm_name?: string | null;
          check_size_min?: number | null;
          check_size_max?: number | null;
          preferred_sectors?: string[];
          preferred_geographies?: string[];
          preferred_stages?: string[];
          accredited_status?: boolean;
          investment_thesis?: string | null;
          contact_preference?: string | null;
          approval_status?: string;
          admin_feedback?: string | null;
          submitted_at?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      founder_remediation_tasks: {
        Row: {
          id: string;
          company_id: string;
          founder_id: string;
          source_type: string;
          source_key: string;
          category: string;
          title: string;
          description: string;
          priority: string;
          status: string;
          recommended_action: string;
          related_feature: string | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          company_id: string;
          founder_id: string;
          source_type: string;
          source_key: string;
          category: string;
          title: string;
          description: string;
          priority: string;
          status?: string;
          recommended_action: string;
          related_feature?: string | null;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: {
          title?: string;
          description?: string;
          priority?: string;
          status?: string;
          recommended_action?: string;
          related_feature?: string | null;
          updated_at?: string;
          completed_at?: string | null;
        };
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
          pledge_amount: number | null;
          pledge_currency: string;
          pledge_amount_updated_at: string | null;
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
          pledge_amount?: number | null;
          pledge_currency?: string;
          pledge_amount_updated_at?: string | null;
          message?: string | null;
          status?: string | null;
        };
        Update: {
          company_id?: string | null;
          campaign_id?: string | null;
          interest_amount?: number | null;
          pledge_amount?: number | null;
          pledge_currency?: string;
          pledge_amount_updated_at?: string | null;
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
    Functions: {
      get_companies_pledge_summaries: {
        Args: { p_company_ids: string[] };
        Returns: {
          company_id: string;
          total_pledged: number;
          investor_count: number;
          currency: string;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
