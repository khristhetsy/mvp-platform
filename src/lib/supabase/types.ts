export type UserRole = "founder" | "investor" | "admin" | "analyst";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  is_super_admin?: boolean;
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
      learning_programs: {
        Row: {
          id: string;
          slug: string;
          title: string;
          description: string;
          readiness_focus: string;
          order_index: number;
          is_published: boolean;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      learning_program_modules: {
        Row: {
          program_id: string;
          module_id: string;
          order_index: number;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      founder_lesson_progress: {
        Row: {
          id: string;
          founder_id: string;
          company_id: string;
          module_slug: string;
          lesson_id: string;
          status: string;
          quiz_score: number | null;
          quiz_passed: boolean | null;
          completed_at: string | null;
          last_viewed_at: string | null;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      founder_quiz_attempts: {
        Row: {
          id: string;
          founder_id: string;
          company_id: string;
          module_slug: string;
          lesson_id: string;
          score: number;
          passed: boolean;
          answers: Record<string, string>;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      founder_lesson_video_assets: {
        Row: {
          id: string;
          founder_id: string;
          company_id: string;
          course_slug: string;
          lesson_slug: string;
          script: string | null;
          narration_text: string | null;
          captions: string | null;
          slides_json: unknown;
          video_url: string | null;
          render_status: string;
          provider: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
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
      spv_opportunities: {
        Row: {
          id: string;
          company_id: string;
          created_by: string;
          name: string;
          target_amount: number | null;
          minimum_commitment: number | null;
          status: string;
          description: string | null;
          terms_summary: string | null;
          checklist_readiness_pct: number;
          document_ready_at: string | null;
          investors_document_ready_count: number;
          investor_pending_requirements_count: number;
          operational_readiness_status: string | null;
          target_amount_reached_notified: boolean;
          package_readiness_pct: number;
          investor_package_status: string | null;
          packages_fully_approved_notified: boolean;
          closing_readiness_pct: number;
          investor_closing_status: string | null;
          closing_final_review_notified: boolean;
          closing_approved_notified: boolean;
          closing_target_override: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          created_by: string;
          name: string;
          target_amount?: number | null;
          minimum_commitment?: number | null;
          status?: string;
          description?: string | null;
          terms_summary?: string | null;
          checklist_readiness_pct?: number;
          document_ready_at?: string | null;
          investors_document_ready_count?: number;
          investor_pending_requirements_count?: number;
          operational_readiness_status?: string | null;
          target_amount_reached_notified?: boolean;
          package_readiness_pct?: number;
          investor_package_status?: string | null;
          packages_fully_approved_notified?: boolean;
          closing_readiness_pct?: number;
          investor_closing_status?: string | null;
          closing_final_review_notified?: boolean;
          closing_approved_notified?: boolean;
          closing_target_override?: boolean;
          updated_at?: string;
        };
        Update: {
          name?: string;
          target_amount?: number | null;
          minimum_commitment?: number | null;
          status?: string;
          description?: string | null;
          terms_summary?: string | null;
          checklist_readiness_pct?: number;
          document_ready_at?: string | null;
          investors_document_ready_count?: number;
          investor_pending_requirements_count?: number;
          operational_readiness_status?: string | null;
          target_amount_reached_notified?: boolean;
          package_readiness_pct?: number;
          investor_package_status?: string | null;
          packages_fully_approved_notified?: boolean;
          closing_readiness_pct?: number;
          investor_closing_status?: string | null;
          closing_final_review_notified?: boolean;
          closing_approved_notified?: boolean;
          closing_target_override?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      spv_closing_reviews: {
        Row: {
          id: string;
          spv_opportunity_id: string;
          company_id: string;
          status: string;
          readiness_snapshot: Record<string, unknown>;
          reviewed_by: string | null;
          reviewed_at: string | null;
          internal_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          spv_opportunity_id: string;
          company_id: string;
          status?: string;
          readiness_snapshot?: Record<string, unknown>;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          internal_notes?: string | null;
          updated_at?: string;
        };
        Update: {
          status?: string;
          readiness_snapshot?: Record<string, unknown>;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          internal_notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      spv_document_packages: {
        Row: {
          id: string;
          spv_opportunity_id: string;
          company_id: string;
          package_type: string;
          status: string;
          prepared_by: string | null;
          reviewed_by: string | null;
          approved_by: string | null;
          prepared_at: string | null;
          reviewed_at: string | null;
          approved_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          spv_opportunity_id: string;
          company_id: string;
          package_type: string;
          status?: string;
          prepared_by?: string | null;
          reviewed_by?: string | null;
          approved_by?: string | null;
          prepared_at?: string | null;
          reviewed_at?: string | null;
          approved_at?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          status?: string;
          prepared_by?: string | null;
          reviewed_by?: string | null;
          approved_by?: string | null;
          prepared_at?: string | null;
          reviewed_at?: string | null;
          approved_at?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      spv_checklist_items: {
        Row: {
          id: string;
          spv_opportunity_id: string;
          item_key: string;
          title: string;
          description: string | null;
          category: string;
          status: string;
          required: boolean;
          completed_by: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          spv_opportunity_id: string;
          item_key: string;
          title: string;
          description?: string | null;
          category: string;
          status?: string;
          required?: boolean;
          completed_by?: string | null;
          completed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          status?: string;
          required?: boolean;
          completed_by?: string | null;
          completed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      spv_participations: {
        Row: {
          id: string;
          spv_opportunity_id: string;
          investor_id: string;
          company_id: string;
          indicative_amount: number | null;
          status: string;
          notes: string | null;
          document_readiness_pct: number;
          document_ready_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          spv_opportunity_id: string;
          investor_id: string;
          company_id: string;
          indicative_amount?: number | null;
          status?: string;
          notes?: string | null;
          document_readiness_pct?: number;
          document_ready_at?: string | null;
          updated_at?: string;
        };
        Update: {
          indicative_amount?: number | null;
          status?: string;
          notes?: string | null;
          document_readiness_pct?: number;
          document_ready_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      spv_participation_requirements: {
        Row: {
          id: string;
          spv_participation_id: string;
          spv_opportunity_id: string;
          investor_id: string;
          requirement_key: string;
          title: string;
          description: string | null;
          category: string;
          status: string;
          required: boolean;
          uploaded_document_id: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          spv_participation_id: string;
          spv_opportunity_id: string;
          investor_id: string;
          requirement_key: string;
          title: string;
          description?: string | null;
          category: string;
          status?: string;
          required?: boolean;
          uploaded_document_id?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
          updated_at?: string;
        };
        Update: {
          status?: string;
          uploaded_document_id?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      company_updates: {
        Row: {
          id: string;
          company_id: string;
          founder_id: string;
          title: string;
          body: string;
          update_type: string;
          visibility: string;
          created_at: string;
          published_at: string | null;
        };
        Insert: {
          company_id: string;
          founder_id: string;
          title: string;
          body: string;
          update_type?: string;
          visibility?: string;
          published_at?: string | null;
        };
        Update: {
          title?: string;
          body?: string;
          update_type?: string;
          visibility?: string;
          published_at?: string | null;
        };
        Relationships: [];
      };
      compliance_events: {
        Row: {
          id: string;
          company_id: string | null;
          founder_id: string | null;
          investor_id: string | null;
          event_type: string;
          severity: string;
          source: string;
          title: string;
          description: string;
          metadata: Record<string, unknown>;
          status: string;
          internal_notes: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          event_type: string;
          severity?: string;
          source?: string;
          title: string;
          description: string;
          metadata?: Record<string, unknown>;
          status?: string;
          company_id?: string | null;
          founder_id?: string | null;
          investor_id?: string | null;
          internal_notes?: string | null;
        };
        Update: {
          severity?: string;
          status?: string;
          metadata?: Record<string, unknown>;
          internal_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        };
        Relationships: [];
      };
      founder_investor_contacts: {
        Row: {
          id: string;
          founder_id: string;
          company_id: string;
          investor_name: string;
          firm_name: string | null;
          email: string | null;
          phone: string | null;
          website: string | null;
          linkedin_url: string | null;
          twitter_url: string | null;
          crunchbase_url: string | null;
          personal_website_url: string | null;
          other_social_url: string | null;
          investor_type: string | null;
          preferred_sectors: string | null;
          preferred_stages: string | null;
          check_size_min: number | null;
          check_size_max: number | null;
          geography: string | null;
          source: string;
          tags: string[];
          notes: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          founder_id: string;
          company_id: string;
          investor_name: string;
          firm_name?: string | null;
          email?: string | null;
          phone?: string | null;
          website?: string | null;
          linkedin_url?: string | null;
          twitter_url?: string | null;
          crunchbase_url?: string | null;
          personal_website_url?: string | null;
          other_social_url?: string | null;
          investor_type?: string | null;
          preferred_sectors?: string | null;
          preferred_stages?: string | null;
          check_size_min?: number | null;
          check_size_max?: number | null;
          geography?: string | null;
          source?: string;
          tags?: string[];
          notes?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          investor_name?: string;
          firm_name?: string | null;
          email?: string | null;
          phone?: string | null;
          website?: string | null;
          linkedin_url?: string | null;
          twitter_url?: string | null;
          crunchbase_url?: string | null;
          personal_website_url?: string | null;
          other_social_url?: string | null;
          investor_type?: string | null;
          preferred_sectors?: string | null;
          preferred_stages?: string | null;
          check_size_min?: number | null;
          check_size_max?: number | null;
          geography?: string | null;
          source?: string;
          tags?: string[];
          notes?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      social_outreach_drafts: {
        Row: {
          id: string;
          founder_id: string;
          company_id: string;
          campaign_id: string | null;
          draft_type: string;
          platform: string;
          title: string;
          body: string;
          status: string;
          compliance_status: string;
          copied_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          founder_id: string;
          company_id: string;
          campaign_id?: string | null;
          draft_type: string;
          platform?: string;
          title: string;
          body: string;
          status?: string;
          compliance_status?: string;
          copied_at?: string | null;
          updated_at?: string;
        };
        Update: {
          campaign_id?: string | null;
          draft_type?: string;
          platform?: string;
          title?: string;
          body?: string;
          status?: string;
          compliance_status?: string;
          copied_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      founder_outreach_targets: {
        Row: {
          id: string;
          company_id: string;
          founder_id: string;
          contact_id: string | null;
          platform_investor_id: string | null;
          match_score: number | null;
          status: string;
          source: string;
          notes: string | null;
          last_contacted_at: string | null;
          next_follow_up_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          founder_id: string;
          contact_id?: string | null;
          platform_investor_id?: string | null;
          match_score?: number | null;
          status?: string;
          source?: string;
          notes?: string | null;
          last_contacted_at?: string | null;
          next_follow_up_at?: string | null;
          updated_at?: string;
        };
        Update: {
          contact_id?: string | null;
          platform_investor_id?: string | null;
          match_score?: number | null;
          status?: string;
          source?: string;
          notes?: string | null;
          last_contacted_at?: string | null;
          next_follow_up_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      outreach_campaigns: {
        Row: {
          id: string;
          founder_id: string;
          company_id: string;
          name: string;
          status: string;
          audience_count: number;
          daily_limit: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          founder_id: string;
          company_id: string;
          name: string;
          status?: string;
          audience_count?: number;
          daily_limit?: number;
          updated_at?: string;
        };
        Update: {
          name?: string;
          status?: string;
          audience_count?: number;
          daily_limit?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      outreach_messages: {
        Row: {
          id: string;
          campaign_id: string;
          contact_id: string;
          subject: string;
          body: string;
          status: string;
          scheduled_at: string | null;
          sent_at: string | null;
          opened_at: string | null;
          replied_at: string | null;
          created_at: string;
        };
        Insert: {
          campaign_id: string;
          contact_id: string;
          subject: string;
          body: string;
          status?: string;
          scheduled_at?: string | null;
          sent_at?: string | null;
          opened_at?: string | null;
          replied_at?: string | null;
        };
        Update: {
          subject?: string;
          body?: string;
          status?: string;
          scheduled_at?: string | null;
          sent_at?: string | null;
          opened_at?: string | null;
          replied_at?: string | null;
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
      import_batches: {
        Row: {
          id: string;
          uploaded_by: string;
          import_type: string;
          file_name: string;
          status: string;
          total_rows: number;
          valid_rows: number;
          warning_rows: number;
          error_rows: number;
          created_rows: number;
          updated_rows: number;
          skipped_rows: number;
          failed_rows: number;
          mapping: Record<string, unknown> | null;
          summary: Record<string, unknown> | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          uploaded_by: string;
          import_type: string;
          file_name: string;
          status?: string;
          total_rows?: number;
          valid_rows?: number;
          warning_rows?: number;
          error_rows?: number;
          created_rows?: number;
          updated_rows?: number;
          skipped_rows?: number;
          failed_rows?: number;
          mapping?: Record<string, unknown> | null;
          summary?: Record<string, unknown> | null;
          completed_at?: string | null;
        };
        Update: {
          status?: string;
          created_rows?: number;
          updated_rows?: number;
          skipped_rows?: number;
          failed_rows?: number;
          summary?: Record<string, unknown> | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      import_batch_rows: {
        Row: {
          id: string;
          batch_id: string;
          row_number: number;
          status: string;
          errors: string[] | null;
          warnings: string[] | null;
          raw_data: Record<string, unknown>;
          mapped_data: Record<string, unknown> | null;
          created_entity_type: string | null;
          created_entity_id: string | null;
          created_at: string;
        };
        Insert: {
          batch_id: string;
          row_number: number;
          status: string;
          errors?: string[] | null;
          warnings?: string[] | null;
          raw_data?: Record<string, unknown>;
          mapped_data?: Record<string, unknown> | null;
          created_entity_type?: string | null;
          created_entity_id?: string | null;
        };
        Update: {
          status?: string;
          errors?: string[] | null;
          created_entity_type?: string | null;
          created_entity_id?: string | null;
        };
        Relationships: [];
      };
      operational_activity_events: {
        Row: {
          id: string;
          event_type: string;
          event_category: string;
          entity_type: string;
          entity_id: string | null;
          actor_user_id: string | null;
          actor_role: string | null;
          company_id: string | null;
          investor_id: string | null;
          spv_id: string | null;
          related_user_id: string | null;
          severity: string;
          title: string;
          description: string | null;
          metadata: Record<string, unknown>;
          source_module: string;
          visibility: string;
          created_at: string;
        };
        Insert: {
          event_type: string;
          event_category: string;
          entity_type: string;
          entity_id?: string | null;
          actor_user_id?: string | null;
          actor_role?: string | null;
          company_id?: string | null;
          investor_id?: string | null;
          spv_id?: string | null;
          related_user_id?: string | null;
          severity?: string;
          title: string;
          description?: string | null;
          metadata?: Record<string, unknown>;
          source_module: string;
          visibility?: string;
        };
        Update: never;
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
      page_builder_drafts: {
        Row: {
          id: string;
          page_slug: string;
          layout: Record<string, unknown>;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          page_slug: string;
          layout?: Record<string, unknown>;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          page_slug?: string;
          layout?: Record<string, unknown>;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      page_builder_snapshots: {
        Row: {
          id: string;
          draft_id: string;
          page_slug: string;
          layout: Record<string, unknown>;
          label: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          draft_id: string;
          page_slug: string;
          layout: Record<string, unknown>;
          label?: string | null;
          created_by?: string | null;
        };
        Update: {
          label?: string | null;
        };
        Relationships: [];
      };
      internal_roles: {
        Row: {
          id: string;
          slug: string;
          label: string;
          description: string | null;
          rank: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          slug: string;
          label: string;
          description?: string | null;
          rank?: number;
          is_active?: boolean;
        };
        Update: Partial<{
          slug: string;
          label: string;
          description: string | null;
          rank: number;
          is_active: boolean;
        }>;
        Relationships: [];
      };
      internal_permissions: {
        Row: {
          id: string;
          slug: string;
          label: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          slug: string;
          label: string;
          description?: string | null;
        };
        Update: Partial<{
          slug: string;
          label: string;
          description: string | null;
        }>;
        Relationships: [];
      };
      internal_role_permissions: {
        Row: {
          role_id: string;
          permission_id: string;
          granted: boolean;
        };
        Insert: {
          role_id: string;
          permission_id: string;
          granted?: boolean;
        };
        Update: Partial<{ granted: boolean }>;
        Relationships: [];
      };
      internal_user_roles: {
        Row: {
          user_id: string;
          role_id: string;
          is_active: boolean;
          assigned_at: string;
          assigned_by: string | null;
        };
        Insert: {
          user_id: string;
          role_id: string;
          is_active?: boolean;
          assigned_at?: string;
          assigned_by?: string | null;
        };
        Update: Partial<{
          role_id: string;
          is_active: boolean;
          assigned_at: string;
          assigned_by: string | null;
        }>;
        Relationships: [];
      };
      internal_user_permission_overrides: {
        Row: {
          user_id: string;
          permission_id: string;
          granted: boolean;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          user_id: string;
          permission_id: string;
          granted: boolean;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<{ granted: boolean; created_by: string | null }>;
        Relationships: [];
      };
      next_best_actions: {
        Row: {
          id: string;
          user_id: string | null;
          role: string;
          entity_type: string | null;
          entity_id: string | null;
          company_id: string | null;
          investor_id: string | null;
          spv_id: string | null;
          action_type: string;
          title: string;
          description: string;
          priority: string;
          category: string;
          status: string;
          href: string;
          source_module: string;
          source_event_id: string | null;
          reason: string | null;
          blockers: unknown;
          metadata: Record<string, unknown>;
          dedupe_key: string;
          source_signature: string;
          due_at: string | null;
          snoozed_until: string | null;
          dismissed_at: string | null;
          completed_at: string | null;
          escalated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          role: string;
          entity_type?: string | null;
          entity_id?: string | null;
          company_id?: string | null;
          investor_id?: string | null;
          spv_id?: string | null;
          action_type: string;
          title: string;
          description?: string;
          priority: string;
          category: string;
          status?: string;
          href: string;
          source_module: string;
          source_event_id?: string | null;
          reason?: string | null;
          blockers?: unknown;
          metadata?: Record<string, unknown>;
          dedupe_key: string;
          source_signature?: string;
          due_at?: string | null;
          snoozed_until?: string | null;
          dismissed_at?: string | null;
          completed_at?: string | null;
          escalated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          user_id: string | null;
          role: string;
          entity_type: string | null;
          entity_id: string | null;
          company_id: string | null;
          investor_id: string | null;
          spv_id: string | null;
          action_type: string;
          title: string;
          description: string;
          priority: string;
          category: string;
          status: string;
          href: string;
          source_module: string;
          source_event_id: string | null;
          reason: string | null;
          blockers: unknown;
          metadata: Record<string, unknown>;
          dedupe_key: string;
          source_signature: string;
          due_at: string | null;
          snoozed_until: string | null;
          dismissed_at: string | null;
          completed_at: string | null;
          escalated_at: string | null;
          updated_at: string;
        }>;
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
