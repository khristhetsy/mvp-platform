export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      _founder_overrides_backup_20260930: {
        Row: {
          id: string | null
          overrides: Json | null
        }
        Insert: {
          id?: string | null
          overrides?: Json | null
        }
        Update: {
          id?: string | null
          overrides?: Json | null
        }
        Relationships: []
      }
      _nba_orphans_backup_20261016: {
        Row: {
          action_type: string | null
          blockers: Json | null
          category: string | null
          company_id: string | null
          completed_at: string | null
          created_at: string | null
          dedupe_key: string | null
          description: string | null
          dismissed_at: string | null
          due_at: string | null
          entity_id: string | null
          entity_type: string | null
          escalated_at: string | null
          href: string | null
          id: string | null
          investor_id: string | null
          metadata: Json | null
          priority: string | null
          reason: string | null
          role: string | null
          snoozed_until: string | null
          source_event_id: string | null
          source_module: string | null
          source_signature: string | null
          spv_id: string | null
          status: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          action_type?: string | null
          blockers?: Json | null
          category?: string | null
          company_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          dedupe_key?: string | null
          description?: string | null
          dismissed_at?: string | null
          due_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          escalated_at?: string | null
          href?: string | null
          id?: string | null
          investor_id?: string | null
          metadata?: Json | null
          priority?: string | null
          reason?: string | null
          role?: string | null
          snoozed_until?: string | null
          source_event_id?: string | null
          source_module?: string | null
          source_signature?: string | null
          spv_id?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string | null
          blockers?: Json | null
          category?: string | null
          company_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          dedupe_key?: string | null
          description?: string | null
          dismissed_at?: string | null
          due_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          escalated_at?: string | null
          href?: string | null
          id?: string | null
          investor_id?: string | null
          metadata?: Json | null
          priority?: string | null
          reason?: string | null
          role?: string | null
          snoozed_until?: string | null
          source_event_id?: string | null
          source_module?: string | null
          source_signature?: string | null
          spv_id?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      _policy_backup_20261018: {
        Row: {
          cmd: string | null
          permissive: string | null
          policyname: unknown
          qual: string | null
          roles: unknown[] | null
          schemaname: unknown
          tablename: unknown
          with_check: string | null
        }
        Insert: {
          cmd?: string | null
          permissive?: string | null
          policyname?: unknown
          qual?: string | null
          roles?: unknown[] | null
          schemaname?: unknown
          tablename?: unknown
          with_check?: string | null
        }
        Update: {
          cmd?: string | null
          permissive?: string | null
          policyname?: unknown
          qual?: string | null
          roles?: unknown[] | null
          schemaname?: unknown
          tablename?: unknown
          with_check?: string | null
        }
        Relationships: []
      }
      acct_bank_accounts: {
        Row: {
          available_balance_cents: number | null
          balance_at: string | null
          created_at: string
          current_balance_cents: number | null
          entity: string
          id: string
          item_id: string | null
          mask: string | null
          name: string
          plaid_account_id: string | null
          subtype: string | null
          type: string | null
        }
        Insert: {
          available_balance_cents?: number | null
          balance_at?: string | null
          created_at?: string
          current_balance_cents?: number | null
          entity?: string
          id?: string
          item_id?: string | null
          mask?: string | null
          name: string
          plaid_account_id?: string | null
          subtype?: string | null
          type?: string | null
        }
        Update: {
          available_balance_cents?: number | null
          balance_at?: string | null
          created_at?: string
          current_balance_cents?: number | null
          entity?: string
          id?: string
          item_id?: string | null
          mask?: string | null
          name?: string
          plaid_account_id?: string | null
          subtype?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acct_bank_accounts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "acct_bank_items"
            referencedColumns: ["id"]
          },
        ]
      }
      acct_bank_items: {
        Row: {
          access_token_enc: string
          created_at: string
          created_by: string | null
          entity: string
          id: string
          institution_name: string | null
          last_error: string | null
          last_synced_at: string | null
          plaid_item_id: string
          status: string
          sync_cursor: string | null
        }
        Insert: {
          access_token_enc: string
          created_at?: string
          created_by?: string | null
          entity?: string
          id?: string
          institution_name?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          plaid_item_id: string
          status?: string
          sync_cursor?: string | null
        }
        Update: {
          access_token_enc?: string
          created_at?: string
          created_by?: string | null
          entity?: string
          id?: string
          institution_name?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          plaid_item_id?: string
          status?: string
          sync_cursor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acct_bank_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      acct_bank_transactions: {
        Row: {
          account_id: string
          amount_cents: number
          category: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          description: string
          external_id: string
          id: string
          matched_invoice_id: string | null
          merchant: string | null
          pending: boolean
          posted_on: string
          source: string
          status: string
        }
        Insert: {
          account_id: string
          amount_cents: number
          category?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          description: string
          external_id: string
          id?: string
          matched_invoice_id?: string | null
          merchant?: string | null
          pending?: boolean
          posted_on: string
          source: string
          status?: string
        }
        Update: {
          account_id?: string
          amount_cents?: number
          category?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          description?: string
          external_id?: string
          id?: string
          matched_invoice_id?: string | null
          merchant?: string | null
          pending?: boolean
          posted_on?: string
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "acct_bank_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "acct_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acct_bank_transactions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acct_bank_transactions_matched_invoice_id_fkey"
            columns: ["matched_invoice_id"]
            isOneToOne: false
            referencedRelation: "acct_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      acct_customers: {
        Row: {
          address: string | null
          archived: boolean
          company: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          crm_contact_id: string | null
          email: string | null
          entity: string
          id: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          archived?: boolean
          company?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          crm_contact_id?: string | null
          email?: string | null
          entity?: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          archived?: boolean
          company?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          crm_contact_id?: string | null
          email?: string | null
          entity?: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acct_customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acct_customers_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "contact_sides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acct_customers_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acct_customers_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "hot_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acct_customers_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "lead_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acct_customers_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "match_campaign_founder_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      acct_invoice_lines: {
        Row: {
          amount_cents: number
          description: string
          id: string
          invoice_id: string
          position: number
          quantity: number
          unit_cents: number
        }
        Insert: {
          amount_cents: number
          description: string
          id?: string
          invoice_id: string
          position?: number
          quantity?: number
          unit_cents: number
        }
        Update: {
          amount_cents?: number
          description?: string
          id?: string
          invoice_id?: string
          position?: number
          quantity?: number
          unit_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "acct_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "acct_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      acct_invoices: {
        Row: {
          amount_paid_cents: number
          client_reported_paid_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string
          due_date: string
          entity: string
          id: string
          invoice_number: string
          issue_date: string
          last_emailed_to: string | null
          memo: string | null
          paid_at: string | null
          public_token: string
          sent_at: string | null
          series_count: number | null
          series_id: string | null
          series_index: number | null
          status: string
          total_cents: number
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          amount_paid_cents?: number
          client_reported_paid_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id: string
          due_date: string
          entity?: string
          id?: string
          invoice_number: string
          issue_date: string
          last_emailed_to?: string | null
          memo?: string | null
          paid_at?: string | null
          public_token?: string
          sent_at?: string | null
          series_count?: number | null
          series_id?: string | null
          series_index?: number | null
          status?: string
          total_cents: number
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          amount_paid_cents?: number
          client_reported_paid_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string
          due_date?: string
          entity?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          last_emailed_to?: string | null
          memo?: string | null
          paid_at?: string | null
          public_token?: string
          sent_at?: string | null
          series_count?: number | null
          series_id?: string | null
          series_index?: number | null
          status?: string
          total_cents?: number
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acct_invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acct_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "acct_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      acct_payments: {
        Row: {
          amount_cents: number
          bank_transaction_id: string | null
          created_at: string
          id: string
          invoice_id: string
          method: string
          paid_on: string
          recorded_by: string | null
          reference: string | null
        }
        Insert: {
          amount_cents: number
          bank_transaction_id?: string | null
          created_at?: string
          id?: string
          invoice_id: string
          method?: string
          paid_on: string
          recorded_by?: string | null
          reference?: string | null
        }
        Update: {
          amount_cents?: number
          bank_transaction_id?: string | null
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string
          paid_on?: string
          recorded_by?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acct_payments_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "acct_bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acct_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "acct_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acct_payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_event_escalations: {
        Row: {
          escalated_at: string
          escalated_to: string | null
          event_id: string
        }
        Insert: {
          escalated_at?: string
          escalated_to?: string | null
          event_id: string
        }
        Update: {
          escalated_at?: string
          escalated_to?: string | null
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_event_escalations_escalated_to_fkey"
            columns: ["escalated_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_event_escalations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "operational_activity_events"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_event_reads: {
        Row: {
          event_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_event_reads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "operational_activity_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_event_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_stage_assignments: {
        Row: {
          audience: string
          created_at: string
          id: string
          is_lead: boolean
          stage: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audience: string
          created_at?: string
          id?: string
          is_lead?: boolean
          stage: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audience?: string
          created_at?: string
          id?: string
          is_lead?: boolean
          stage?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_stage_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_stage_policies: {
        Row: {
          audience: string
          escalate_after_minutes: number | null
          escalate_to_user_id: string | null
          stage: string
          updated_at: string
        }
        Insert: {
          audience: string
          escalate_after_minutes?: number | null
          escalate_to_user_id?: string | null
          stage: string
          updated_at?: string
        }
        Update: {
          audience?: string
          escalate_after_minutes?: number | null
          escalate_to_user_id?: string | null
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_stage_policies_escalate_to_user_id_fkey"
            columns: ["escalate_to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_learning_stage_overrides: {
        Row: {
          capital_stage: string
          company_id: string
          created_at: string
          founder_id: string
          id: string
          is_unlocked: boolean
          notes: string | null
          overridden_at: string
          overridden_by: string
        }
        Insert: {
          capital_stage: string
          company_id: string
          created_at?: string
          founder_id: string
          id?: string
          is_unlocked?: boolean
          notes?: string | null
          overridden_at?: string
          overridden_by: string
        }
        Update: {
          capital_stage?: string
          company_id?: string
          created_at?: string
          founder_id?: string
          id?: string
          is_unlocked?: boolean
          notes?: string | null
          overridden_at?: string
          overridden_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_learning_stage_overrides_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_learning_stage_overrides_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_lesson_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          company_id: string
          created_at: string
          founder_id: string
          id: string
          lesson_id: string
          lesson_title: string
          module_slug: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          company_id: string
          created_at?: string
          founder_id: string
          id?: string
          lesson_id: string
          lesson_title: string
          module_slug: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          company_id?: string
          created_at?: string
          founder_id?: string
          id?: string
          lesson_id?: string
          lesson_title?: string
          module_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_lesson_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_lesson_assignments_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_reviews: {
        Row: {
          company_id: string | null
          created_at: string | null
          feedback: string | null
          founder_id: string | null
          id: string
          notes: string | null
          requested_changes: string | null
          reviewed_by: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          feedback?: string | null
          founder_id?: string | null
          id?: string
          notes?: string | null
          requested_changes?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          feedback?: string | null
          founder_id?: string | null
          id?: string
          notes?: string | null
          requested_changes?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_reviews_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_task_activity: {
        Row: {
          actor_id: string
          comment_text: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["task_activity_event"]
          id: string
          payload: Json
          task_id: string
        }
        Insert: {
          actor_id: string
          comment_text?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["task_activity_event"]
          id?: string
          payload?: Json
          task_id: string
        }
        Update: {
          actor_id?: string
          comment_text?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["task_activity_event"]
          id?: string
          payload?: Json
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_task_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "admin_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_task_attachments: {
        Row: {
          converted_to_pdf: boolean
          created_at: string
          file_name: string
          id: string
          mime_type: string
          original_storage_path: string | null
          size_bytes: number
          source_format: string
          storage_path: string
          task_id: string
          uploaded_by: string
        }
        Insert: {
          converted_to_pdf?: boolean
          created_at?: string
          file_name: string
          id?: string
          mime_type: string
          original_storage_path?: string | null
          size_bytes: number
          source_format: string
          storage_path: string
          task_id: string
          uploaded_by: string
        }
        Update: {
          converted_to_pdf?: boolean
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string
          original_storage_path?: string | null
          size_bytes?: number
          source_format?: string
          storage_path?: string
          task_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "admin_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_task_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_tasks: {
        Row: {
          archived_at: string | null
          assignee_id: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          owner_label: string | null
          position: number
          priority: Database["public"]["Enums"]["task_priority"]
          source_meeting_session_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          tags: string[]
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["task_visibility"]
        }
        Insert: {
          archived_at?: string | null
          assignee_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          owner_label?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          source_meeting_session_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[]
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["task_visibility"]
        }
        Update: {
          archived_at?: string | null
          assignee_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          owner_label?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          source_meeting_session_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[]
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["task_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "admin_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_tasks_source_meeting_session_id_fkey"
            columns: ["source_meeting_session_id"]
            isOneToOne: false
            referencedRelation: "ceo_meeting_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      aeo_pages: {
        Row: {
          compliance_status: string
          created_at: string
          defined_term: string | null
          definition_answer: string
          eyebrow: string | null
          faq: Json
          h1: string
          id: string
          lede: string | null
          meta_description: string | null
          published_at: string | null
          sections: Json
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          compliance_status?: string
          created_at?: string
          defined_term?: string | null
          definition_answer: string
          eyebrow?: string | null
          faq?: Json
          h1: string
          id?: string
          lede?: string | null
          meta_description?: string | null
          published_at?: string | null
          sections?: Json
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          compliance_status?: string
          created_at?: string
          defined_term?: string | null
          definition_answer?: string
          eyebrow?: string | null
          faq?: Json
          h1?: string
          id?: string
          lede?: string | null
          meta_description?: string | null
          published_at?: string | null
          sections?: Json
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      aeo_publish_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          detail: string | null
          id: string
          page_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          detail?: string | null
          id?: string
          page_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          detail?: string | null
          id?: string
          page_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aeo_publish_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aeo_publish_log_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "aeo_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      aeo_settings: {
        Row: {
          deal_names_masked: boolean
          id: boolean
          security_page_noindexed: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          deal_names_masked?: boolean
          id?: boolean
          security_page_noindexed?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          deal_names_masked?: boolean
          id?: boolean
          security_page_noindexed?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aeo_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_budget_alerts: {
        Row: {
          month: string
          scope: string
          sent_at: string
          threshold: number
        }
        Insert: {
          month: string
          scope: string
          sent_at?: string
          threshold: number
        }
        Update: {
          month?: string
          scope?: string
          sent_at?: string
          threshold?: number
        }
        Relationships: []
      }
      ai_budget_settings: {
        Row: {
          alert_email: string
          id: number
          updated_at: string
        }
        Insert: {
          alert_email: string
          id?: number
          updated_at?: string
        }
        Update: {
          alert_email?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_budgets: {
        Row: {
          category: string
          monthly_usd: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          monthly_usd: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          monthly_usd?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_budgets_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_spend_events: {
        Row: {
          category: string
          cost_usd: number
          created_at: string
          feature: string
          id: string
          input_tokens: number | null
          model: string | null
          output_tokens: number | null
          path: string | null
          profile_id: string | null
          units: number | null
          vendor: string
        }
        Insert: {
          category: string
          cost_usd?: number
          created_at?: string
          feature: string
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          path?: string | null
          profile_id?: string | null
          units?: number | null
          vendor: string
        }
        Update: {
          category?: string
          cost_usd?: number
          created_at?: string
          feature?: string
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          path?: string | null
          profile_id?: string | null
          units?: number | null
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_spend_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_events: {
        Row: {
          created_at: string
          feature: string
          id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          feature: string
          id?: string
          profile_id: string
        }
        Update: {
          created_at?: string
          feature?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_limits: {
        Row: {
          feature: string
          id: string
          max_runs: number | null
          period: string
          plan: string
          updated_at: string
        }
        Insert: {
          feature: string
          id?: string
          max_runs?: number | null
          period?: string
          plan: string
          updated_at?: string
        }
        Update: {
          feature?: string
          id?: string
          max_runs?: number | null
          period?: string
          plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      assessment_leads: {
        Row: {
          answers: Json
          capital_structure: string | null
          company_name: string | null
          converted_contact_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          lead_prescore: number
          score_band: string
          stage: string | null
          updated_at: string
          utm: Json | null
        }
        Insert: {
          answers?: Json
          capital_structure?: string | null
          company_name?: string | null
          converted_contact_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          lead_prescore: number
          score_band: string
          stage?: string | null
          updated_at?: string
          utm?: Json | null
        }
        Update: {
          answers?: Json
          capital_structure?: string | null
          company_name?: string | null
          converted_contact_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          lead_prescore?: number
          score_band?: string
          stage?: string | null
          updated_at?: string
          utm?: Json | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_actions: {
        Row: {
          action_type: string
          created_at: string
          id: string
          message: string | null
          metadata: Json
          run_id: string
          status: string
          target_entity_id: string | null
          target_entity_type: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json
          run_id: string
          status?: string
          target_entity_id?: string | null
          target_entity_type?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json
          run_id?: string
          status?: string
          target_entity_id?: string | null
          target_entity_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_actions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          actions_executed: number
          actions_skipped: number
          completed_at: string | null
          dry_run: boolean
          duration_ms: number | null
          entity_id: string | null
          entity_type: string | null
          failures_count: number
          id: string
          metadata: Json
          source_event_id: string | null
          started_at: string
          status: string
          trigger_type: string | null
        }
        Insert: {
          actions_executed?: number
          actions_skipped?: number
          completed_at?: string | null
          dry_run?: boolean
          duration_ms?: number | null
          entity_id?: string | null
          entity_type?: string | null
          failures_count?: number
          id?: string
          metadata?: Json
          source_event_id?: string | null
          started_at?: string
          status?: string
          trigger_type?: string | null
        }
        Update: {
          actions_executed?: number
          actions_skipped?: number
          completed_at?: string | null
          dry_run?: boolean
          duration_ms?: number | null
          entity_id?: string | null
          entity_type?: string | null
          failures_count?: number
          id?: string
          metadata?: Json
          source_event_id?: string | null
          started_at?: string
          status?: string
          trigger_type?: string | null
        }
        Relationships: []
      }
      beta_feedback: {
        Row: {
          admin_notes: string | null
          category: string
          created_at: string
          id: string
          message: string
          profile_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          role: string
          screenshot_url: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          category: string
          created_at?: string
          id?: string
          message: string
          profile_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          role: string
          screenshot_url?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          profile_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string
          screenshot_url?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "beta_feedback_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beta_feedback_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_consents: {
        Row: {
          accepted_at: string
          created_at: string | null
          email: string | null
          id: string
          plan_type: string | null
          policy_version: string | null
          profile_id: string
          user_agent: string | null
        }
        Insert: {
          accepted_at: string
          created_at?: string | null
          email?: string | null
          id?: string
          plan_type?: string | null
          policy_version?: string | null
          profile_id: string
          user_agent?: string | null
        }
        Update: {
          accepted_at?: string
          created_at?: string | null
          email?: string | null
          id?: string
          plan_type?: string | null
          policy_version?: string | null
          profile_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      business_plans: {
        Row: {
          ai_assisted: boolean
          assumptions: Json
          charts: Json
          company_id: string
          created_at: string
          exec_summary: string | null
          finalized_at: string | null
          generated_at: string | null
          id: string
          last_edited_by: string | null
          projections: Json | null
          sections: Json
          status: string
          updated_at: string
        }
        Insert: {
          ai_assisted?: boolean
          assumptions?: Json
          charts?: Json
          company_id: string
          created_at?: string
          exec_summary?: string | null
          finalized_at?: string | null
          generated_at?: string | null
          id?: string
          last_edited_by?: string | null
          projections?: Json | null
          sections?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          ai_assisted?: boolean
          assumptions?: Json
          charts?: Json
          company_id?: string
          created_at?: string
          exec_summary?: string | null
          finalized_at?: string | null
          generated_at?: string | null
          id?: string
          last_edited_by?: string | null
          projections?: Json | null
          sections?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_plans_last_edited_by_fkey"
            columns: ["last_edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          attendees: Json
          created_at: string
          department_id: string | null
          description: string | null
          end_time: string
          event_kind: string | null
          external_event_id: string | null
          external_provider: string | null
          id: string
          linked_record_id: string | null
          linked_record_type: string | null
          location: string | null
          meet_url: string | null
          meeting_key: string | null
          owner_id: string
          reminder_1h_sent_at: string | null
          reminder_24h_sent_at: string | null
          reminder_sent_at: string | null
          source: string
          start_time: string
          status: string
          timezone: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          attendees?: Json
          created_at?: string
          department_id?: string | null
          description?: string | null
          end_time: string
          event_kind?: string | null
          external_event_id?: string | null
          external_provider?: string | null
          id?: string
          linked_record_id?: string | null
          linked_record_type?: string | null
          location?: string | null
          meet_url?: string | null
          meeting_key?: string | null
          owner_id: string
          reminder_1h_sent_at?: string | null
          reminder_24h_sent_at?: string | null
          reminder_sent_at?: string | null
          source?: string
          start_time: string
          status?: string
          timezone?: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          attendees?: Json
          created_at?: string
          department_id?: string | null
          description?: string | null
          end_time?: string
          event_kind?: string | null
          external_event_id?: string | null
          external_provider?: string | null
          id?: string
          linked_record_id?: string | null
          linked_record_type?: string | null
          location?: string | null
          meet_url?: string | null
          meeting_key?: string | null
          owner_id?: string
          reminder_1h_sent_at?: string | null
          reminder_24h_sent_at?: string | null
          reminder_sent_at?: string | null
          source?: string
          start_time?: string
          status?: string
          timezone?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_meeting_key_fkey"
            columns: ["meeting_key"]
            isOneToOne: false
            referencedRelation: "ceo_meetings"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "calendar_events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_attempts: {
        Row: {
          ai_disclosed_at: string | null
          attempt_no: number
          booked: boolean
          campaign_id: string | null
          contact_id: string
          cost: number | null
          created_at: string
          disposition: string | null
          duration: number | null
          id: string
          recording_url: string | null
          status: string | null
          transcript_url: string | null
          transferred_to: string | null
          variant_id: string | null
        }
        Insert: {
          ai_disclosed_at?: string | null
          attempt_no?: number
          booked?: boolean
          campaign_id?: string | null
          contact_id: string
          cost?: number | null
          created_at?: string
          disposition?: string | null
          duration?: number | null
          id?: string
          recording_url?: string | null
          status?: string | null
          transcript_url?: string | null
          transferred_to?: string | null
          variant_id?: string | null
        }
        Update: {
          ai_disclosed_at?: string | null
          attempt_no?: number
          booked?: boolean
          campaign_id?: string | null
          contact_id?: string
          cost?: number | null
          created_at?: string
          disposition?: string | null
          duration?: number | null
          id?: string
          recording_url?: string | null
          status?: string | null
          transcript_url?: string | null
          transferred_to?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_attempts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "voice_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_attempts_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "campaign_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_variants: {
        Row: {
          cadence_config: Json
          campaign_id: string
          created_at: string
          id: string
          label: string
          opener_script: string | null
          traffic_weight: number
        }
        Insert: {
          cadence_config?: Json
          campaign_id: string
          created_at?: string
          id?: string
          label: string
          opener_script?: string | null
          traffic_weight?: number
        }
        Update: {
          cadence_config?: Json
          campaign_id?: string
          created_at?: string
          id?: string
          label?: string
          opener_script?: string | null
          traffic_weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_variants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "voice_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          company_id: string | null
          created_at: string | null
          funding_target: number | null
          id: string
          market_opportunity: string | null
          minimum_investment: number | null
          problem: string | null
          published_at: string | null
          risk_disclosures: string | null
          slug: string | null
          solution: string | null
          status: string | null
          title: string | null
          traction: string | null
          use_of_funds: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          funding_target?: number | null
          id?: string
          market_opportunity?: string | null
          minimum_investment?: number | null
          problem?: string | null
          published_at?: string | null
          risk_disclosures?: string | null
          slug?: string | null
          solution?: string | null
          status?: string | null
          title?: string | null
          traction?: string | null
          use_of_funds?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          funding_target?: number | null
          id?: string
          market_opportunity?: string | null
          minimum_investment?: number | null
          problem?: string | null
          published_at?: string | null
          risk_disclosures?: string | null
          slug?: string | null
          solution?: string | null
          status?: string | null
          title?: string | null
          traction?: string | null
          use_of_funds?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cap_tables: {
        Row: {
          company_id: string
          created_at: string
          holders: Json
          id: string
          last_edited_by: string | null
          round: Json | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          holders?: Json
          id?: string
          last_edited_by?: string | null
          round?: Json | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          holders?: Json
          id?: string
          last_edited_by?: string | null
          round?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cap_tables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cap_tables_last_edited_by_fkey"
            columns: ["last_edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_briefs: {
        Row: {
          brief_date: string
          business: Database["public"]["Enums"]["ceo_business"]
          created_at: string | null
          headline: string
          id: string
          model: string | null
          sections: Json
        }
        Insert: {
          brief_date: string
          business?: Database["public"]["Enums"]["ceo_business"]
          created_at?: string | null
          headline?: string
          id?: string
          model?: string | null
          sections?: Json
        }
        Update: {
          brief_date?: string
          business?: Database["public"]["Enums"]["ceo_business"]
          created_at?: string | null
          headline?: string
          id?: string
          model?: string | null
          sections?: Json
        }
        Relationships: []
      }
      ceo_campaign_results: {
        Row: {
          agent_id: string | null
          created_at: string
          created_by: string | null
          id: string
          impressions: number
          meetings: number
          members_reached: number
          positive_replies: number
          run_date: string
          strategy: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          impressions?: number
          meetings?: number
          members_reached?: number
          positive_replies?: number
          run_date: string
          strategy: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          impressions?: number
          meetings?: number
          members_reached?: number
          positive_replies?: number
          run_date?: string
          strategy?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_campaign_results_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_campaign_results_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_checklist_template_items: {
        Row: {
          department_id: string | null
          id: string
          offset_days: number
          phase: string
          position: number
          template_id: string
          title: string
        }
        Insert: {
          department_id?: string | null
          id?: string
          offset_days: number
          phase: string
          position?: number
          template_id: string
          title: string
        }
        Update: {
          department_id?: string | null
          id?: string
          offset_days?: number
          phase?: string
          position?: number
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_checklist_template_items_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_checklist_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "ceo_checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_checklist_templates: {
        Row: {
          created_at: string
          event_kind: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          event_kind?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          event_kind?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      ceo_client_onboarding: {
        Row: {
          added_on: string
          company_id: string | null
          company_name: string
          conference_ready: boolean
          created_at: string
          created_by: string | null
          id: string
        }
        Insert: {
          added_on?: string
          company_id?: string | null
          company_name: string
          conference_ready?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
        }
        Update: {
          added_on?: string
          company_id?: string | null
          company_name?: string
          conference_ready?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_client_onboarding_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_client_onboarding_items: {
        Row: {
          done: boolean
          done_at: string | null
          item_key: string
          onboarding_id: string
        }
        Insert: {
          done?: boolean
          done_at?: string | null
          item_key: string
          onboarding_id: string
        }
        Update: {
          done?: boolean
          done_at?: string | null
          item_key?: string
          onboarding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_client_onboarding_items_onboarding_id_fkey"
            columns: ["onboarding_id"]
            isOneToOne: false
            referencedRelation: "ceo_client_onboarding"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_conference_sessions: {
        Row: {
          conference_id: string
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          position: number
          session_url: string | null
          speaker: string | null
          starts_at: string | null
          title: string
        }
        Insert: {
          conference_id: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          position?: number
          session_url?: string | null
          speaker?: string | null
          starts_at?: string | null
          title: string
        }
        Update: {
          conference_id?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          position?: number
          session_url?: string | null
          speaker?: string | null
          starts_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_conference_sessions_conference_id_fkey"
            columns: ["conference_id"]
            isOneToOne: false
            referencedRelation: "ceo_conferences"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_conferences: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          end_date: string | null
          event_id: string | null
          event_url: string | null
          host_id: string | null
          id: string
          kind: string
          location: string | null
          start_date: string
          status: string
          timezone: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          end_date?: string | null
          event_id?: string | null
          event_url?: string | null
          host_id?: string | null
          id?: string
          kind?: string
          location?: string | null
          start_date: string
          status?: string
          timezone?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          end_date?: string | null
          event_id?: string | null
          event_url?: string | null
          host_id?: string | null
          id?: string
          kind?: string
          location?: string | null
          start_date?: string
          status?: string
          timezone?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_conferences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_conferences_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_conferences_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_conferences_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_daily_phrase: {
        Row: {
          business: Database["public"]["Enums"]["ceo_business"]
          created_at: string | null
          id: string
          model: string | null
          phrase: string
          phrase_date: string
        }
        Insert: {
          business?: Database["public"]["Enums"]["ceo_business"]
          created_at?: string | null
          id?: string
          model?: string | null
          phrase: string
          phrase_date: string
        }
        Update: {
          business?: Database["public"]["Enums"]["ceo_business"]
          created_at?: string | null
          id?: string
          model?: string | null
          phrase?: string
          phrase_date?: string
        }
        Relationships: []
      }
      ceo_email_campaign_schedule: {
        Row: {
          audience: string
          created_at: string
          created_by: string | null
          id: string
          linked_event_id: string | null
          platform: string
          provider_message_id: string | null
          scheduled_date: string | null
          status: string
          topic: string
          week_start: string
        }
        Insert: {
          audience: string
          created_at?: string
          created_by?: string | null
          id?: string
          linked_event_id?: string | null
          platform?: string
          provider_message_id?: string | null
          scheduled_date?: string | null
          status?: string
          topic: string
          week_start: string
        }
        Update: {
          audience?: string
          created_at?: string
          created_by?: string | null
          id?: string
          linked_event_id?: string | null
          platform?: string
          provider_message_id?: string | null
          scheduled_date?: string | null
          status?: string
          topic?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_email_campaign_schedule_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_event_registrations: {
        Row: {
          attended: boolean | null
          conference_id: string
          created_at: string
          email: string | null
          external_id: string | null
          id: string
          name: string | null
          registered_at: string
          registrant_type: string | null
          source: string
        }
        Insert: {
          attended?: boolean | null
          conference_id: string
          created_at?: string
          email?: string | null
          external_id?: string | null
          id?: string
          name?: string | null
          registered_at?: string
          registrant_type?: string | null
          source?: string
        }
        Update: {
          attended?: boolean | null
          conference_id?: string
          created_at?: string
          email?: string | null
          external_id?: string | null
          id?: string
          name?: string | null
          registered_at?: string
          registrant_type?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_event_registrations_conference_id_fkey"
            columns: ["conference_id"]
            isOneToOne: false
            referencedRelation: "ceo_conferences"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_goals: {
        Row: {
          business: Database["public"]["Enums"]["ceo_business"]
          created_at: string | null
          current: number | null
          due_date: string | null
          id: string
          metric: string | null
          period: string | null
          sort_order: number
          target: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          business?: Database["public"]["Enums"]["ceo_business"]
          created_at?: string | null
          current?: number | null
          due_date?: string | null
          id?: string
          metric?: string | null
          period?: string | null
          sort_order?: number
          target?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          business?: Database["public"]["Enums"]["ceo_business"]
          created_at?: string | null
          current?: number | null
          due_date?: string | null
          id?: string
          metric?: string | null
          period?: string | null
          sort_order?: number
          target?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ceo_kpi_ai: {
        Row: {
          coach_prompt: string
          created_at: string | null
          diagnosis: string
          id: string
          kpi_key: string
          mentorship: string
          model: string
          solutions: Json
          week_start: string
        }
        Insert: {
          coach_prompt: string
          created_at?: string | null
          diagnosis: string
          id?: string
          kpi_key: string
          mentorship: string
          model: string
          solutions: Json
          week_start: string
        }
        Update: {
          coach_prompt?: string
          created_at?: string | null
          diagnosis?: string
          id?: string
          kpi_key?: string
          mentorship?: string
          model?: string
          solutions?: Json
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_kpi_ai_kpi_key_fkey"
            columns: ["kpi_key"]
            isOneToOne: false
            referencedRelation: "ceo_kpi_registry"
            referencedColumns: ["key"]
          },
        ]
      }
      ceo_kpi_meeting_agent_entries: {
        Row: {
          actual_value: number | null
          agent_id: string
          entered_by: string | null
          goal_value: number | null
          id: string
          kpi_id: string
          updated_at: string
          week_start: string
        }
        Insert: {
          actual_value?: number | null
          agent_id: string
          entered_by?: string | null
          goal_value?: number | null
          id?: string
          kpi_id: string
          updated_at?: string
          week_start: string
        }
        Update: {
          actual_value?: number | null
          agent_id?: string
          entered_by?: string | null
          goal_value?: number | null
          id?: string
          kpi_id?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_kpi_meeting_agent_entries_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ceo_kpi_meeting_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_kpi_meeting_agent_entries_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_kpi_meeting_agent_entries_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "ceo_kpi_meeting_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_kpi_meeting_agent_entries_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "v_ceo_kpi_meeting_monthly"
            referencedColumns: ["kpi_id"]
          },
          {
            foreignKeyName: "ceo_kpi_meeting_agent_entries_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "v_ceo_kpi_meeting_quarterly"
            referencedColumns: ["kpi_id"]
          },
          {
            foreignKeyName: "ceo_kpi_meeting_agent_entries_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "v_ceo_kpi_meeting_weekly"
            referencedColumns: ["kpi_id"]
          },
          {
            foreignKeyName: "ceo_kpi_meeting_agent_entries_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "v_ceo_kpi_meeting_ytd"
            referencedColumns: ["kpi_id"]
          },
        ]
      }
      ceo_kpi_meeting_agents: {
        Row: {
          created_at: string
          department_id: string
          id: string
          is_active: boolean
          name: string
          position: number
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          is_active?: boolean
          name: string
          position?: number
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          is_active?: boolean
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "ceo_kpi_meeting_agents_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_kpi_meeting_definitions: {
        Row: {
          created_at: string
          department_id: string
          id: string
          is_active: boolean
          key: string
          label: string
          position: number
          unit: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          is_active?: boolean
          key: string
          label: string
          position?: number
          unit?: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          position?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_kpi_meeting_definitions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_kpi_meeting_entries: {
        Row: {
          agent_id: string | null
          entered_by: string | null
          id: string
          kpi_id: string
          updated_at: string
          value: number
          week_start: string
        }
        Insert: {
          agent_id?: string | null
          entered_by?: string | null
          id?: string
          kpi_id: string
          updated_at?: string
          value: number
          week_start: string
        }
        Update: {
          agent_id?: string | null
          entered_by?: string | null
          id?: string
          kpi_id?: string
          updated_at?: string
          value?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_kpi_meeting_entries_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_kpi_meeting_entries_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_kpi_meeting_entries_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "ceo_kpi_meeting_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_kpi_meeting_entries_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "v_ceo_kpi_meeting_monthly"
            referencedColumns: ["kpi_id"]
          },
          {
            foreignKeyName: "ceo_kpi_meeting_entries_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "v_ceo_kpi_meeting_quarterly"
            referencedColumns: ["kpi_id"]
          },
          {
            foreignKeyName: "ceo_kpi_meeting_entries_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "v_ceo_kpi_meeting_weekly"
            referencedColumns: ["kpi_id"]
          },
          {
            foreignKeyName: "ceo_kpi_meeting_entries_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "v_ceo_kpi_meeting_ytd"
            referencedColumns: ["kpi_id"]
          },
        ]
      }
      ceo_kpi_meeting_goal_values: {
        Row: {
          id: string
          kpi_id: string
          period: string
          period_start: string
          value: number
        }
        Insert: {
          id?: string
          kpi_id: string
          period: string
          period_start: string
          value: number
        }
        Update: {
          id?: string
          kpi_id?: string
          period?: string
          period_start?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "ceo_kpi_meeting_goal_values_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "ceo_kpi_meeting_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_kpi_meeting_goal_values_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "v_ceo_kpi_meeting_monthly"
            referencedColumns: ["kpi_id"]
          },
          {
            foreignKeyName: "ceo_kpi_meeting_goal_values_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "v_ceo_kpi_meeting_quarterly"
            referencedColumns: ["kpi_id"]
          },
          {
            foreignKeyName: "ceo_kpi_meeting_goal_values_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "v_ceo_kpi_meeting_weekly"
            referencedColumns: ["kpi_id"]
          },
          {
            foreignKeyName: "ceo_kpi_meeting_goal_values_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "v_ceo_kpi_meeting_ytd"
            referencedColumns: ["kpi_id"]
          },
        ]
      }
      ceo_kpi_meeting_goals: {
        Row: {
          growth_factor: number
          id: string
          kpi_id: string
          mode: string
          period: string
          pinned_by: string | null
          pinned_value: number | null
          ratchet_only: boolean
        }
        Insert: {
          growth_factor?: number
          id?: string
          kpi_id: string
          mode?: string
          period: string
          pinned_by?: string | null
          pinned_value?: number | null
          ratchet_only?: boolean
        }
        Update: {
          growth_factor?: number
          id?: string
          kpi_id?: string
          mode?: string
          period?: string
          pinned_by?: string | null
          pinned_value?: number | null
          ratchet_only?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ceo_kpi_meeting_goals_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "ceo_kpi_meeting_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_kpi_meeting_goals_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "v_ceo_kpi_meeting_monthly"
            referencedColumns: ["kpi_id"]
          },
          {
            foreignKeyName: "ceo_kpi_meeting_goals_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "v_ceo_kpi_meeting_quarterly"
            referencedColumns: ["kpi_id"]
          },
          {
            foreignKeyName: "ceo_kpi_meeting_goals_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "v_ceo_kpi_meeting_weekly"
            referencedColumns: ["kpi_id"]
          },
          {
            foreignKeyName: "ceo_kpi_meeting_goals_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "v_ceo_kpi_meeting_ytd"
            referencedColumns: ["kpi_id"]
          },
          {
            foreignKeyName: "ceo_kpi_meeting_goals_pinned_by_fkey"
            columns: ["pinned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_kpi_registry: {
        Row: {
          active: boolean
          benchmark: string | null
          business: Database["public"]["Enums"]["ceo_business"]
          definition: string
          dept: string
          direction: string
          fmt: string
          key: string
          label: string
          owner: string
          red_line: number
          scales_with_period: boolean
          sort_order: number
          source_view: string
          target: number
          weight: number
        }
        Insert: {
          active?: boolean
          benchmark?: string | null
          business?: Database["public"]["Enums"]["ceo_business"]
          definition?: string
          dept: string
          direction: string
          fmt: string
          key: string
          label: string
          owner: string
          red_line: number
          scales_with_period?: boolean
          sort_order: number
          source_view: string
          target: number
          weight?: number
        }
        Update: {
          active?: boolean
          benchmark?: string | null
          business?: Database["public"]["Enums"]["ceo_business"]
          definition?: string
          dept?: string
          direction?: string
          fmt?: string
          key?: string
          label?: string
          owner?: string
          red_line?: number
          scales_with_period?: boolean
          sort_order?: number
          source_view?: string
          target?: number
          weight?: number
        }
        Relationships: []
      }
      ceo_kpi_snapshots: {
        Row: {
          created_at: string | null
          id: string
          kpi_key: string
          value: number
          week_start: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          kpi_key: string
          value: number
          week_start: string
        }
        Update: {
          created_at?: string | null
          id?: string
          kpi_key?: string
          value?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_kpi_snapshots_kpi_key_fkey"
            columns: ["kpi_key"]
            isOneToOne: false
            referencedRelation: "ceo_kpi_registry"
            referencedColumns: ["key"]
          },
        ]
      }
      ceo_meeting_ai_briefs: {
        Row: {
          created_by: string | null
          focus_points: Json
          generated_at: string
          id: string
          input_hash: string
          model: string | null
          narrative: string
          risks: Json
          session_id: string
        }
        Insert: {
          created_by?: string | null
          focus_points?: Json
          generated_at?: string
          id?: string
          input_hash: string
          model?: string | null
          narrative: string
          risks?: Json
          session_id: string
        }
        Update: {
          created_by?: string | null
          focus_points?: Json
          generated_at?: string
          id?: string
          input_hash?: string
          model?: string | null
          narrative?: string
          risks?: Json
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_meeting_ai_briefs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_meeting_ai_briefs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ceo_meeting_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_meeting_attendees: {
        Row: {
          session_id: string
          status: string
          user_id: string
        }
        Insert: {
          session_id: string
          status?: string
          user_id: string
        }
        Update: {
          session_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_meeting_attendees_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ceo_meeting_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_meeting_attendees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_meeting_kpi_snapshots: {
        Row: {
          captured_at: string
          department_id: string | null
          id: string
          payload: Json
          session_id: string
          source: string
        }
        Insert: {
          captured_at?: string
          department_id?: string | null
          id?: string
          payload: Json
          session_id: string
          source: string
        }
        Update: {
          captured_at?: string
          department_id?: string | null
          id?: string
          payload?: Json
          session_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_meeting_kpi_snapshots_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_meeting_kpi_snapshots_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ceo_meeting_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_meeting_occurrences: {
        Row: {
          created_at: string | null
          created_by: string | null
          duration_min: number | null
          gcal_event_id: string | null
          id: string
          meeting_key: string
          note: string | null
          occurs_on: string
          time_local: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          duration_min?: number | null
          gcal_event_id?: string | null
          id?: string
          meeting_key: string
          note?: string | null
          occurs_on: string
          time_local?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          duration_min?: number | null
          gcal_event_id?: string | null
          id?: string
          meeting_key?: string
          note?: string | null
          occurs_on?: string
          time_local?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ceo_meeting_occurrences_meeting_key_fkey"
            columns: ["meeting_key"]
            isOneToOne: false
            referencedRelation: "ceo_meetings"
            referencedColumns: ["key"]
          },
        ]
      }
      ceo_meeting_readiness_log: {
        Row: {
          captured_at: string
          department_id: string | null
          id: string
          section_id: string | null
          session_id: string
          status: string | null
        }
        Insert: {
          captured_at?: string
          department_id?: string | null
          id?: string
          section_id?: string | null
          session_id: string
          status?: string | null
        }
        Update: {
          captured_at?: string
          department_id?: string | null
          id?: string
          section_id?: string | null
          session_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ceo_meeting_readiness_log_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_meeting_readiness_log_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "ceo_meeting_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_meeting_readiness_log_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "v_ceo_meeting_readiness"
            referencedColumns: ["section_id"]
          },
          {
            foreignKeyName: "ceo_meeting_readiness_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ceo_meeting_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_meeting_reminder_log: {
        Row: {
          id: string
          section_id: string | null
          sent_at: string
          session_id: string
          threshold: string
        }
        Insert: {
          id?: string
          section_id?: string | null
          sent_at?: string
          session_id: string
          threshold: string
        }
        Update: {
          id?: string
          section_id?: string | null
          sent_at?: string
          session_id?: string
          threshold?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_meeting_reminder_log_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "ceo_meeting_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_meeting_reminder_log_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "v_ceo_meeting_readiness"
            referencedColumns: ["section_id"]
          },
          {
            foreignKeyName: "ceo_meeting_reminder_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ceo_meeting_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_meeting_section_entries: {
        Row: {
          content: string
          id: string
          prepared_by: string | null
          presented_by: string | null
          section_id: string
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          content?: string
          id?: string
          prepared_by?: string | null
          presented_by?: string | null
          section_id: string
          session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          content?: string
          id?: string
          prepared_by?: string | null
          presented_by?: string | null
          section_id?: string
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_meeting_section_entries_prepared_by_fkey"
            columns: ["prepared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_meeting_section_entries_presented_by_fkey"
            columns: ["presented_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_meeting_section_entries_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "ceo_meeting_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_meeting_section_entries_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "v_ceo_meeting_readiness"
            referencedColumns: ["section_id"]
          },
          {
            foreignKeyName: "ceo_meeting_section_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ceo_meeting_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_meeting_section_versions: {
        Row: {
          content: string
          edited_at: string
          edited_by: string | null
          entry_id: string
          id: string
        }
        Insert: {
          content: string
          edited_at?: string
          edited_by?: string | null
          entry_id: string
          id?: string
        }
        Update: {
          content?: string
          edited_at?: string
          edited_by?: string | null
          entry_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_meeting_section_versions_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_meeting_section_versions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "ceo_meeting_section_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_meeting_sections: {
        Row: {
          created_at: string
          default_presenter_id: string | null
          department_id: string | null
          id: string
          is_required: boolean
          kpi_view: string | null
          meeting_key: string
          pinned: string | null
          position: number
          section_kind: string
          title: string
        }
        Insert: {
          created_at?: string
          default_presenter_id?: string | null
          department_id?: string | null
          id?: string
          is_required?: boolean
          kpi_view?: string | null
          meeting_key: string
          pinned?: string | null
          position: number
          section_kind?: string
          title: string
        }
        Update: {
          created_at?: string
          default_presenter_id?: string | null
          department_id?: string | null
          id?: string
          is_required?: boolean
          kpi_view?: string | null
          meeting_key?: string
          pinned?: string | null
          position?: number
          section_kind?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_meeting_sections_default_presenter_id_fkey"
            columns: ["default_presenter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_meeting_sections_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_meeting_sections_meeting_key_fkey"
            columns: ["meeting_key"]
            isOneToOne: false
            referencedRelation: "ceo_meetings"
            referencedColumns: ["key"]
          },
        ]
      }
      ceo_meeting_sessions: {
        Row: {
          attendance: string | null
          created_at: string | null
          created_by: string | null
          decisions: Json
          ended_at: string | null
          gcal_instance_id: string | null
          id: string
          meet_link: string | null
          meeting_key: string
          note: string | null
          session_date: string
          start_time: string | null
          started_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          attendance?: string | null
          created_at?: string | null
          created_by?: string | null
          decisions?: Json
          ended_at?: string | null
          gcal_instance_id?: string | null
          id?: string
          meet_link?: string | null
          meeting_key: string
          note?: string | null
          session_date: string
          start_time?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          attendance?: string | null
          created_at?: string | null
          created_by?: string | null
          decisions?: Json
          ended_at?: string | null
          gcal_instance_id?: string | null
          id?: string
          meet_link?: string | null
          meeting_key?: string
          note?: string | null
          session_date?: string
          start_time?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ceo_meeting_sessions_meeting_key_fkey"
            columns: ["meeting_key"]
            isOneToOne: false
            referencedRelation: "ceo_meetings"
            referencedColumns: ["key"]
          },
        ]
      }
      ceo_meeting_task_suggestions: {
        Row: {
          confirmed_task_id: string | null
          created_at: string
          id: string
          rationale: string | null
          section_id: string | null
          session_id: string | null
          status: string
          suggested_assignee_id: string | null
          suggested_department_id: string | null
          suggested_due: string | null
          title: string
        }
        Insert: {
          confirmed_task_id?: string | null
          created_at?: string
          id?: string
          rationale?: string | null
          section_id?: string | null
          session_id?: string | null
          status?: string
          suggested_assignee_id?: string | null
          suggested_department_id?: string | null
          suggested_due?: string | null
          title: string
        }
        Update: {
          confirmed_task_id?: string | null
          created_at?: string
          id?: string
          rationale?: string | null
          section_id?: string | null
          session_id?: string | null
          status?: string
          suggested_assignee_id?: string | null
          suggested_department_id?: string | null
          suggested_due?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_meeting_task_suggestions_confirmed_task_id_fkey"
            columns: ["confirmed_task_id"]
            isOneToOne: false
            referencedRelation: "ceo_meeting_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_meeting_task_suggestions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "ceo_meeting_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_meeting_task_suggestions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "v_ceo_meeting_readiness"
            referencedColumns: ["section_id"]
          },
          {
            foreignKeyName: "ceo_meeting_task_suggestions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ceo_meeting_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_meeting_task_suggestions_suggested_assignee_id_fkey"
            columns: ["suggested_assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_meeting_task_suggestions_suggested_department_id_fkey"
            columns: ["suggested_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_meeting_tasks: {
        Row: {
          agent_note: string | null
          assignee_id: string | null
          ceo_note: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          due_date: string | null
          id: string
          linked_event_id: string | null
          priority: string
          session_id: string | null
          source: string
          start_date: string | null
          status: string
          title: string
        }
        Insert: {
          agent_note?: string | null
          assignee_id?: string | null
          ceo_note?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          due_date?: string | null
          id?: string
          linked_event_id?: string | null
          priority?: string
          session_id?: string | null
          source?: string
          start_date?: string | null
          status?: string
          title: string
        }
        Update: {
          agent_note?: string | null
          assignee_id?: string | null
          ceo_note?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          due_date?: string | null
          id?: string
          linked_event_id?: string | null
          priority?: string
          session_id?: string | null
          source?: string
          start_date?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_meeting_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_meeting_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_meeting_tasks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_meeting_tasks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ceo_meeting_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_meetings: {
        Row: {
          active: boolean | null
          agenda: Json
          attendees: Json
          cadence: string
          day_of_week: number
          dept: string
          duration_min: number
          gcal_event_id: string | null
          key: string
          name: string
          time_local: string
          timezone: string
          workflow: Json
        }
        Insert: {
          active?: boolean | null
          agenda?: Json
          attendees?: Json
          cadence?: string
          day_of_week: number
          dept: string
          duration_min: number
          gcal_event_id?: string | null
          key: string
          name: string
          time_local: string
          timezone?: string
          workflow?: Json
        }
        Update: {
          active?: boolean | null
          agenda?: Json
          attendees?: Json
          cadence?: string
          day_of_week?: number
          dept?: string
          duration_min?: number
          gcal_event_id?: string | null
          key?: string
          name?: string
          time_local?: string
          timezone?: string
          workflow?: Json
        }
        Relationships: []
      }
      ceo_notification_prefs: {
        Row: {
          email_daily: boolean
          email_weekly: boolean
          updated_at: string | null
          user_id: string
        }
        Insert: {
          email_daily?: boolean
          email_weekly?: boolean
          updated_at?: string | null
          user_id: string
        }
        Update: {
          email_daily?: boolean
          email_weekly?: boolean
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ceo_plan_milestones: {
        Row: {
          created_at: string
          done: boolean
          done_at: string | null
          due_date: string | null
          id: string
          objective_id: string
          owner_id: string | null
          position: number
          title: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          due_date?: string | null
          id?: string
          objective_id: string
          owner_id?: string | null
          position?: number
          title: string
        }
        Update: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          due_date?: string | null
          id?: string
          objective_id?: string
          owner_id?: string | null
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_plan_milestones_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "ceo_plan_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_plan_milestones_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_plan_objectives: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          id: string
          period_label: string | null
          position: number
          status: string
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          period_label?: string | null
          position?: number
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          id?: string
          period_label?: string | null
          position?: number
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ceo_plan_objectives_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_plan_objectives_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_recommendations: {
        Row: {
          business: Database["public"]["Enums"]["ceo_business"]
          created_at: string | null
          detail: string
          hub: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          business?: Database["public"]["Enums"]["ceo_business"]
          created_at?: string | null
          detail?: string
          hub?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          business?: Database["public"]["Enums"]["ceo_business"]
          created_at?: string | null
          detail?: string
          hub?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ceo_user_prefs: {
        Row: {
          business: Database["public"]["Enums"]["ceo_business"]
          prefs: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          business?: Database["public"]["Enums"]["ceo_business"]
          prefs?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          business?: Database["public"]["Enums"]["ceo_business"]
          prefs?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      coach_commitments: {
        Row: {
          company_id: string
          course_slug: string
          created_at: string
          due_at: string
          due_choice: string
          founder_id: string
          id: string
          lesson_id: string
          resolved_at: string | null
          status: string
          step_index: number
          task_ref: string | null
          title: string
        }
        Insert: {
          company_id: string
          course_slug: string
          created_at?: string
          due_at: string
          due_choice: string
          founder_id: string
          id?: string
          lesson_id: string
          resolved_at?: string | null
          status?: string
          step_index: number
          task_ref?: string | null
          title: string
        }
        Update: {
          company_id?: string
          course_slug?: string
          created_at?: string
          due_at?: string
          due_choice?: string
          founder_id?: string
          id?: string
          lesson_id?: string
          resolved_at?: string | null
          status?: string
          step_index?: number
          task_ref?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_commitments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_commitments_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_counsel_reviews: {
        Row: {
          content_hash: string
          course_key: string
          created_at: string
          id: string
          recorded_by: string | null
          reference: string | null
          reviewed_on: string
          reviewer_name: string
        }
        Insert: {
          content_hash: string
          course_key: string
          created_at?: string
          id?: string
          recorded_by?: string | null
          reference?: string | null
          reviewed_on: string
          reviewer_name: string
        }
        Update: {
          content_hash?: string
          course_key?: string
          created_at?: string
          id?: string
          recorded_by?: string | null
          reference?: string | null
          reviewed_on?: string
          reviewer_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_counsel_reviews_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_enrollments: {
        Row: {
          company_id: string
          created_at: string
          enrolled_by: string | null
          founder_id: string
          id: string
          intake: Json
          paused_at: string | null
          source: string
          started_at: string
          status: string
          tone: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          enrolled_by?: string | null
          founder_id: string
          id?: string
          intake?: Json
          paused_at?: string | null
          source?: string
          started_at?: string
          status?: string
          tone?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          enrolled_by?: string | null
          founder_id?: string
          id?: string
          intake?: Json
          paused_at?: string | null
          source?: string
          started_at?: string
          status?: string
          tone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_enrollments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_enrollments_enrolled_by_fkey"
            columns: ["enrolled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_enrollments_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_messages: {
        Row: {
          channel: string
          company_id: string
          created_at: string
          founder_id: string
          id: string
          kind: string
          metadata: Json
          notification_id: string | null
          opened_at: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
          suppressed_reason: string | null
          tone: string
        }
        Insert: {
          channel: string
          company_id: string
          created_at?: string
          founder_id: string
          id?: string
          kind: string
          metadata?: Json
          notification_id?: string | null
          opened_at?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          suppressed_reason?: string | null
          tone: string
        }
        Update: {
          channel?: string
          company_id?: string
          created_at?: string
          founder_id?: string
          id?: string
          kind?: string
          metadata?: Json
          notification_id?: string | null
          opened_at?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          suppressed_reason?: string | null
          tone?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_messages_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_messages_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_screenshots: {
        Row: {
          app_version: string | null
          approved_app_version: string | null
          approved_at: string | null
          approved_by: string | null
          approved_captured_at: string | null
          approved_hash: string | null
          approved_image_path: string | null
          capture_error: string | null
          capture_requested_at: string | null
          captured_at: string | null
          content_hash: string | null
          control_label: string | null
          course_slug: string
          image_path: string | null
          learning_id: string | null
          lesson_id: string
          menu_path: string[]
          needs_fix: boolean
          needs_fix_note: string | null
          pinned: boolean
          route: string
          step_index: number
          step_key: string
          step_title: string
          updated_at: string
        }
        Insert: {
          app_version?: string | null
          approved_app_version?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_captured_at?: string | null
          approved_hash?: string | null
          approved_image_path?: string | null
          capture_error?: string | null
          capture_requested_at?: string | null
          captured_at?: string | null
          content_hash?: string | null
          control_label?: string | null
          course_slug: string
          image_path?: string | null
          learning_id?: string | null
          lesson_id: string
          menu_path?: string[]
          needs_fix?: boolean
          needs_fix_note?: string | null
          pinned?: boolean
          route: string
          step_index: number
          step_key: string
          step_title: string
          updated_at?: string
        }
        Update: {
          app_version?: string | null
          approved_app_version?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_captured_at?: string | null
          approved_hash?: string | null
          approved_image_path?: string | null
          capture_error?: string | null
          capture_requested_at?: string | null
          captured_at?: string | null
          content_hash?: string | null
          control_label?: string | null
          course_slug?: string
          image_path?: string | null
          learning_id?: string | null
          lesson_id?: string
          menu_path?: string[]
          needs_fix?: boolean
          needs_fix_note?: string | null
          pinned?: boolean
          route?: string
          step_index?: number
          step_key?: string
          step_title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_screenshots_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_step_events: {
        Row: {
          company_id: string
          course_slug: string
          created_at: string
          event: string
          founder_id: string
          id: string
          lesson_id: string
          note: string | null
          step_index: number
        }
        Insert: {
          company_id: string
          course_slug: string
          created_at?: string
          event: string
          founder_id: string
          id?: string
          lesson_id: string
          note?: string | null
          step_index: number
        }
        Update: {
          company_id?: string
          course_slug?: string
          created_at?: string
          event?: string
          founder_id?: string
          id?: string
          lesson_id?: string
          note?: string | null
          step_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "coach_step_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_step_events_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collaboration_comments: {
        Row: {
          author_user_id: string
          body: string
          created_at: string
          id: string
          is_internal_note: boolean
          mentions: Json
          thread_id: string
          updated_at: string
          visibility: string
        }
        Insert: {
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          is_internal_note?: boolean
          mentions?: Json
          thread_id: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          is_internal_note?: boolean
          mentions?: Json
          thread_id?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaboration_comments_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_comments_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "collaboration_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      collaboration_threads: {
        Row: {
          company_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          investor_profile_id: string | null
          spv_id: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          investor_profile_id?: string | null
          spv_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          investor_profile_id?: string | null
          spv_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaboration_threads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_threads_investor_profile_id_fkey"
            columns: ["investor_profile_id"]
            isOneToOne: false
            referencedRelation: "investor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaboration_threads_spv_id_fkey"
            columns: ["spv_id"]
            isOneToOne: false
            referencedRelation: "spv_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          active_investor_preference: string | null
          annual_ebitda: string | null
          annual_revenue_size: string | null
          approved_at: string | null
          approved_by: string | null
          arr: string | null
          business_description: string | null
          business_entity: string | null
          cap_table_summary: string | null
          capital_ready_at: string | null
          company_name: string
          contact_phone: string | null
          country: string | null
          created_at: string | null
          figures_attested_at: string | null
          figures_attested_by: string | null
          founder_goals: string | null
          founder_id: string | null
          funding_amount: number | null
          funding_amount_band: string | null
          funding_stage: string | null
          id: string
          incorporation_jurisdiction: string | null
          industry: string | null
          is_published: boolean
          is_sample: boolean
          key_highlights: string | null
          learning_readiness_bonus: number
          listing_completed_at: string | null
          listing_opt_in_at: string | null
          logo_url: string | null
          management_team: string | null
          marketplace_visible: boolean
          mrr: string | null
          offering_type: Database["public"]["Enums"]["offering_type"]
          offering_type_attested_at: string | null
          offering_type_attested_by: string | null
          onboarding_completed_at: string | null
          onboarding_progress_percent: number
          onboarding_step_state: Json
          operating_stage: string | null
          org_id: string | null
          partner_code: string | null
          published_at: string | null
          revenue_stage: string | null
          review_status: string | null
          seeking_capital_types: string | null
          seeking_investor_types: string | null
          slug: string | null
          state: string | null
          status: string | null
          team_summary: string | null
          updated_at: string | null
          use_of_funds: string | null
          website: string | null
        }
        Insert: {
          active_investor_preference?: string | null
          annual_ebitda?: string | null
          annual_revenue_size?: string | null
          approved_at?: string | null
          approved_by?: string | null
          arr?: string | null
          business_description?: string | null
          business_entity?: string | null
          cap_table_summary?: string | null
          capital_ready_at?: string | null
          company_name: string
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          figures_attested_at?: string | null
          figures_attested_by?: string | null
          founder_goals?: string | null
          founder_id?: string | null
          funding_amount?: number | null
          funding_amount_band?: string | null
          funding_stage?: string | null
          id?: string
          incorporation_jurisdiction?: string | null
          industry?: string | null
          is_published?: boolean
          is_sample?: boolean
          key_highlights?: string | null
          learning_readiness_bonus?: number
          listing_completed_at?: string | null
          listing_opt_in_at?: string | null
          logo_url?: string | null
          management_team?: string | null
          marketplace_visible?: boolean
          mrr?: string | null
          offering_type?: Database["public"]["Enums"]["offering_type"]
          offering_type_attested_at?: string | null
          offering_type_attested_by?: string | null
          onboarding_completed_at?: string | null
          onboarding_progress_percent?: number
          onboarding_step_state?: Json
          operating_stage?: string | null
          org_id?: string | null
          partner_code?: string | null
          published_at?: string | null
          revenue_stage?: string | null
          review_status?: string | null
          seeking_capital_types?: string | null
          seeking_investor_types?: string | null
          slug?: string | null
          state?: string | null
          status?: string | null
          team_summary?: string | null
          updated_at?: string | null
          use_of_funds?: string | null
          website?: string | null
        }
        Update: {
          active_investor_preference?: string | null
          annual_ebitda?: string | null
          annual_revenue_size?: string | null
          approved_at?: string | null
          approved_by?: string | null
          arr?: string | null
          business_description?: string | null
          business_entity?: string | null
          cap_table_summary?: string | null
          capital_ready_at?: string | null
          company_name?: string
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          figures_attested_at?: string | null
          figures_attested_by?: string | null
          founder_goals?: string | null
          founder_id?: string | null
          funding_amount?: number | null
          funding_amount_band?: string | null
          funding_stage?: string | null
          id?: string
          incorporation_jurisdiction?: string | null
          industry?: string | null
          is_published?: boolean
          is_sample?: boolean
          key_highlights?: string | null
          learning_readiness_bonus?: number
          listing_completed_at?: string | null
          listing_opt_in_at?: string | null
          logo_url?: string | null
          management_team?: string | null
          marketplace_visible?: boolean
          mrr?: string | null
          offering_type?: Database["public"]["Enums"]["offering_type"]
          offering_type_attested_at?: string | null
          offering_type_attested_by?: string | null
          onboarding_completed_at?: string | null
          onboarding_progress_percent?: number
          onboarding_step_state?: Json
          operating_stage?: string | null
          org_id?: string | null
          partner_code?: string | null
          published_at?: string | null
          revenue_stage?: string | null
          review_status?: string | null
          seeking_capital_types?: string | null
          seeking_investor_types?: string | null
          slug?: string | null
          state?: string | null
          status?: string | null
          team_summary?: string | null
          updated_at?: string | null
          use_of_funds?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_figures_attested_by_fkey"
            columns: ["figures_attested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_invites: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          company_id: string
          created_at: string
          expires_at: string
          id: string
          invitee_email: string
          inviter_id: string
          role: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          company_id: string
          created_at?: string
          expires_at?: string
          id?: string
          invitee_email: string
          inviter_id: string
          role?: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          company_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          invitee_email?: string
          inviter_id?: string
          role?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_invites_accepted_by_user_id_fkey"
            columns: ["accepted_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_metric_snapshots: {
        Row: {
          capture_date: string
          captured_at: string
          company_id: string
          created_at: string
          id: string
          readiness_score: number | null
          total_indicated: number
        }
        Insert: {
          capture_date?: string
          captured_at?: string
          company_id: string
          created_at?: string
          id?: string
          readiness_score?: number | null
          total_indicated?: number
        }
        Update: {
          capture_date?: string
          captured_at?: string
          company_id?: string
          created_at?: string
          id?: string
          readiness_score?: number | null
          total_indicated?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_metric_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_readiness_scores: {
        Row: {
          change_kind: string | null
          change_reason: string | null
          company_id: string
          created_at: string
          dimension_advice: Json
          document_count: number
          effective_score: number | null
          factor_scores: Json
          id: string
          outreach_unlocked: boolean
          overridden_at: string | null
          overridden_by: string | null
          override_reason: string | null
          override_score: number | null
          rubric_version: string | null
          score_angel: number | null
          score_growth_institutional: number | null
          score_seed_institutional: number | null
          score_seriesa_institutional: number | null
          score_version: string
          scored_by: string
          total_score: number
          updated_at: string
          weight_set_id: string | null
        }
        Insert: {
          change_kind?: string | null
          change_reason?: string | null
          company_id: string
          created_at?: string
          dimension_advice?: Json
          document_count?: number
          effective_score?: number | null
          factor_scores?: Json
          id?: string
          outreach_unlocked?: boolean
          overridden_at?: string | null
          overridden_by?: string | null
          override_reason?: string | null
          override_score?: number | null
          rubric_version?: string | null
          score_angel?: number | null
          score_growth_institutional?: number | null
          score_seed_institutional?: number | null
          score_seriesa_institutional?: number | null
          score_version?: string
          scored_by?: string
          total_score: number
          updated_at?: string
          weight_set_id?: string | null
        }
        Update: {
          change_kind?: string | null
          change_reason?: string | null
          company_id?: string
          created_at?: string
          dimension_advice?: Json
          document_count?: number
          effective_score?: number | null
          factor_scores?: Json
          id?: string
          outreach_unlocked?: boolean
          overridden_at?: string | null
          overridden_by?: string | null
          override_reason?: string | null
          override_score?: number | null
          rubric_version?: string | null
          score_angel?: number | null
          score_growth_institutional?: number | null
          score_seed_institutional?: number | null
          score_seriesa_institutional?: number | null
          score_version?: string
          scored_by?: string
          total_score?: number
          updated_at?: string
          weight_set_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_readiness_scores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_readiness_scores_overridden_by_fkey"
            columns: ["overridden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_readiness_scores_weight_set_id_fkey"
            columns: ["weight_set_id"]
            isOneToOne: false
            referencedRelation: "crr_weight_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      company_summaries: {
        Row: {
          approved_by: string | null
          company: string
          company_key: string
          hq_city: string | null
          source_url: string | null
          status: string
          summary: string
          updated_at: string
          website: string | null
        }
        Insert: {
          approved_by?: string | null
          company: string
          company_key: string
          hq_city?: string | null
          source_url?: string | null
          status?: string
          summary: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          approved_by?: string | null
          company?: string
          company_key?: string
          hq_city?: string | null
          source_url?: string | null
          status?: string
          summary?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_summaries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_updates: {
        Row: {
          body: string
          company_id: string
          created_at: string
          founder_id: string
          id: string
          published_at: string | null
          title: string
          update_type: string
          visibility: string
        }
        Insert: {
          body: string
          company_id: string
          created_at?: string
          founder_id: string
          id?: string
          published_at?: string | null
          title: string
          update_type?: string
          visibility?: string
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string
          founder_id?: string
          id?: string
          published_at?: string | null
          title?: string
          update_type?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_updates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_updates_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_events: {
        Row: {
          company_id: string | null
          created_at: string
          description: string
          event_type: string
          founder_id: string | null
          id: string
          internal_notes: string | null
          investor_id: string | null
          metadata: Json
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          source: string
          status: string
          title: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description: string
          event_type: string
          founder_id?: string | null
          id?: string
          internal_notes?: string | null
          investor_id?: string | null
          metadata?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          source?: string
          status?: string
          title: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string
          event_type?: string
          founder_id?: string | null
          id?: string
          internal_notes?: string | null
          investor_id?: string | null
          metadata?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          source?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_events_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_events_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_events_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connected_accounts: {
        Row: {
          access_token_encrypted: string
          connected_at: string
          email: string | null
          id: string
          last_refresh_at: string | null
          provider: string
          provider_user_id: string
          refresh_token_encrypted: string | null
          scopes: string[]
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted: string
          connected_at?: string
          email?: string | null
          id?: string
          last_refresh_at?: string | null
          provider: string
          provider_user_id: string
          refresh_token_encrypted?: string | null
          scopes?: string[]
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string
          connected_at?: string
          email?: string | null
          id?: string
          last_refresh_at?: string | null
          provider?: string
          provider_user_id?: string
          refresh_token_encrypted?: string | null
          scopes?: string[]
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connected_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          call_timezone: string | null
          captured_at: string
          channel: string
          consent_type: string
          contact_id: string
          created_at: string
          evidence_url: string | null
          expires_at: string | null
          id: string
          jurisdiction: string | null
          phone: string | null
          reconsent_sent_at: string | null
          reconsent_status: string
          revoked_at: string | null
          source: string | null
        }
        Insert: {
          call_timezone?: string | null
          captured_at?: string
          channel: string
          consent_type: string
          contact_id: string
          created_at?: string
          evidence_url?: string | null
          expires_at?: string | null
          id?: string
          jurisdiction?: string | null
          phone?: string | null
          reconsent_sent_at?: string | null
          reconsent_status?: string
          revoked_at?: string | null
          source?: string | null
        }
        Update: {
          call_timezone?: string | null
          captured_at?: string
          channel?: string
          consent_type?: string
          contact_id?: string
          created_at?: string
          evidence_url?: string | null
          expires_at?: string | null
          id?: string
          jurisdiction?: string | null
          phone?: string | null
          reconsent_sent_at?: string | null
          reconsent_status?: string
          revoked_at?: string | null
          source?: string | null
        }
        Relationships: []
      }
      contact_custom_fields: {
        Row: {
          created_at: string
          created_by: string | null
          key: string
          label: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          key: string
          label: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          key?: string
          label?: string
        }
        Relationships: []
      }
      contact_domain_cache: {
        Row: {
          domain: string
          fetched_at: string
          parsed: Json
          status: number | null
        }
        Insert: {
          domain: string
          fetched_at?: string
          parsed?: Json
          status?: number | null
        }
        Update: {
          domain?: string
          fetched_at?: string
          parsed?: Json
          status?: number | null
        }
        Relationships: []
      }
      contact_field_mappings: {
        Row: {
          action: string
          custom_key: string | null
          id: string
          source: string
          source_column: string
          target_field: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          action: string
          custom_key?: string | null
          id?: string
          source: string
          source_column: string
          target_field?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          action?: string
          custom_key?: string | null
          id?: string
          source?: string
          source_column?: string
          target_field?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      contact_fill_proposals: {
        Row: {
          basis: string
          contact_id: string
          created_at: string
          field: string
          id: string
          method: string
          reviewed_at: string | null
          reviewed_by: string | null
          run_id: string
          status: string
          value: string
        }
        Insert: {
          basis: string
          contact_id: string
          created_at?: string
          field: string
          id?: string
          method: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          run_id: string
          status?: string
          value: string
        }
        Update: {
          basis?: string
          contact_id?: string
          created_at?: string
          field?: string
          id?: string
          method?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          run_id?: string
          status?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_fill_proposals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact_sides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_fill_proposals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_fill_proposals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "hot_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_fill_proposals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "lead_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_fill_proposals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "match_campaign_founder_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_fill_suggestions: {
        Row: {
          basis: string | null
          confidence: string | null
          contact_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          field: string
          id: string
          label: string
          origin: string
          source_url: string | null
          status: string
          value: Json
        }
        Insert: {
          basis?: string | null
          confidence?: string | null
          contact_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          field: string
          id?: string
          label: string
          origin?: string
          source_url?: string | null
          status?: string
          value: Json
        }
        Update: {
          basis?: string | null
          confidence?: string | null
          contact_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          field?: string
          id?: string
          label?: string
          origin?: string
          source_url?: string | null
          status?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "contact_fill_suggestions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact_sides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_fill_suggestions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_fill_suggestions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "hot_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_fill_suggestions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "lead_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_fill_suggestions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "match_campaign_founder_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_fill_suggestions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_finder_suggestions: {
        Row: {
          alternatives: string[]
          confident: boolean
          contact_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          field: string
          id: string
          note: string | null
          source: string
          status: string
          value: string
        }
        Insert: {
          alternatives?: string[]
          confident?: boolean
          contact_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          field: string
          id?: string
          note?: string | null
          source: string
          status?: string
          value: string
        }
        Update: {
          alternatives?: string[]
          confident?: boolean
          contact_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          field?: string
          id?: string
          note?: string | null
          source?: string
          status?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_finder_suggestions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact_sides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_finder_suggestions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_finder_suggestions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "hot_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_finder_suggestions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "lead_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_finder_suggestions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "match_campaign_founder_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_finder_suggestions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_lookups: {
        Row: {
          contact_id: string
          created_at: string
          field: string
          id: string
          outcome: string
          run_by: string | null
          source: string
          value: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          field: string
          id?: string
          outcome: string
          run_by?: string | null
          source: string
          value?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          field?: string
          id?: string
          outcome?: string
          run_by?: string | null
          source?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_lookups_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact_sides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_lookups_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_lookups_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "hot_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_lookups_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "lead_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_lookups_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "match_campaign_founder_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_lookups_run_by_fkey"
            columns: ["run_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_merges: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          kept_before: Json | null
          kept_id: string
          merged_by: string | null
          merged_external_id: string | null
          merged_id: string
          merged_row: Json
          merged_source: string | null
          moved: Json
          reason: string | null
          undone_at: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          kept_before?: Json | null
          kept_id: string
          merged_by?: string | null
          merged_external_id?: string | null
          merged_id: string
          merged_row: Json
          merged_source?: string | null
          moved?: Json
          reason?: string | null
          undone_at?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          kept_before?: Json | null
          kept_id?: string
          merged_by?: string | null
          merged_external_id?: string | null
          merged_id?: string
          merged_row?: Json
          merged_source?: string | null
          moved?: Json
          reason?: string | null
          undone_at?: string | null
        }
        Relationships: []
      }
      contact_pending_values: {
        Row: {
          contact_id: string
          first_seen_at: string
          id: string
          resolved_at: string | null
          source: string
          source_column: string
          value: string
        }
        Insert: {
          contact_id: string
          first_seen_at?: string
          id?: string
          resolved_at?: string | null
          source: string
          source_column: string
          value: string
        }
        Update: {
          contact_id?: string
          first_seen_at?: string
          id?: string
          resolved_at?: string | null
          source?: string
          source_column?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_pending_values_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact_sides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_pending_values_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_pending_values_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "hot_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_pending_values_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "lead_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_pending_values_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "match_campaign_founder_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_documents: {
        Row: {
          archived_at: string | null
          body_edits: Json
          certificate_path: string | null
          contact_id: string | null
          contract_type: string | null
          countersign_fields: Json | null
          created_at: string
          created_by: string
          document_key: string
          docx_path: string | null
          entity_id: string | null
          executed_path: string | null
          expires_at: string | null
          field_values: Json
          id: string
          last_opened_at: string | null
          locked: boolean
          open_count: number
          packet_id: string | null
          page_count: number | null
          pdf_path: string | null
          sent_at: string | null
          signature_request_id: string | null
          source: string
          status: string
          template_id: string | null
          template_version: number | null
          title: string | null
          updated_at: string
          upload_path: string | null
          version: number
        }
        Insert: {
          archived_at?: string | null
          body_edits?: Json
          certificate_path?: string | null
          contact_id?: string | null
          contract_type?: string | null
          countersign_fields?: Json | null
          created_at?: string
          created_by: string
          document_key?: string
          docx_path?: string | null
          entity_id?: string | null
          executed_path?: string | null
          expires_at?: string | null
          field_values?: Json
          id?: string
          last_opened_at?: string | null
          locked?: boolean
          open_count?: number
          packet_id?: string | null
          page_count?: number | null
          pdf_path?: string | null
          sent_at?: string | null
          signature_request_id?: string | null
          source?: string
          status?: string
          template_id?: string | null
          template_version?: number | null
          title?: string | null
          updated_at?: string
          upload_path?: string | null
          version?: number
        }
        Update: {
          archived_at?: string | null
          body_edits?: Json
          certificate_path?: string | null
          contact_id?: string | null
          contract_type?: string | null
          countersign_fields?: Json | null
          created_at?: string
          created_by?: string
          document_key?: string
          docx_path?: string | null
          entity_id?: string | null
          executed_path?: string | null
          expires_at?: string | null
          field_values?: Json
          id?: string
          last_opened_at?: string | null
          locked?: boolean
          open_count?: number
          packet_id?: string | null
          page_count?: number | null
          pdf_path?: string | null
          sent_at?: string | null
          signature_request_id?: string | null
          source?: string
          status?: string
          template_id?: string | null
          template_version?: number | null
          title?: string | null
          updated_at?: string
          upload_path?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_documents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact_sides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "hot_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "lead_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "match_campaign_founder_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "contract_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_packet_id_fkey"
            columns: ["packet_id"]
            isOneToOne: false
            referencedRelation: "contract_packets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_signature_request_id_fkey"
            columns: ["signature_request_id"]
            isOneToOne: false
            referencedRelation: "signature_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_entities: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          id: string
          key: string
          legal_name: string
          short_name: string
          signatory_name: string | null
          signatory_title: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          key: string
          legal_name: string
          short_name: string
          signatory_name?: string | null
          signatory_title?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          key?: string
          legal_name?: string
          short_name?: string
          signatory_name?: string | null
          signatory_title?: string | null
        }
        Relationships: []
      }
      contract_events: {
        Row: {
          actor: string | null
          contract_document_id: string
          created_at: string
          detail: Json | null
          id: string
          kind: string
        }
        Insert: {
          actor?: string | null
          contract_document_id: string
          created_at?: string
          detail?: Json | null
          id?: string
          kind: string
        }
        Update: {
          actor?: string | null
          contract_document_id?: string
          created_at?: string
          detail?: Json | null
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_events_contract_document_id_fkey"
            columns: ["contract_document_id"]
            isOneToOne: false
            referencedRelation: "contract_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_packets: {
        Row: {
          access_token: string
          attach_pdfs: boolean
          body: string
          contact_id: string
          delivered: boolean
          email_draft_id: string | null
          id: string
          recipient_email: string
          recipient_name: string | null
          sent_at: string
          sent_by: string
          subject: string
        }
        Insert: {
          access_token: string
          attach_pdfs?: boolean
          body: string
          contact_id: string
          delivered?: boolean
          email_draft_id?: string | null
          id?: string
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string
          sent_by: string
          subject: string
        }
        Update: {
          access_token?: string
          attach_pdfs?: boolean
          body?: string
          contact_id?: string
          delivered?: boolean
          email_draft_id?: string | null
          id?: string
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string
          sent_by?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_packets_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact_sides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_packets_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_packets_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "hot_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_packets_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "lead_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_packets_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "match_campaign_founder_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_packets_email_draft_id_fkey"
            columns: ["email_draft_id"]
            isOneToOne: false
            referencedRelation: "marketing_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_send_drafts: {
        Row: {
          contact_id: string
          email: Json | null
          extra_ids: string[]
          step: number
          term_sheet_id: string | null
          unlinked: Json
          updated_at: string
          updated_by: string | null
          upload_ids: string[]
        }
        Insert: {
          contact_id: string
          email?: Json | null
          extra_ids?: string[]
          step?: number
          term_sheet_id?: string | null
          unlinked?: Json
          updated_at?: string
          updated_by?: string | null
          upload_ids?: string[]
        }
        Update: {
          contact_id?: string
          email?: Json | null
          extra_ids?: string[]
          step?: number
          term_sheet_id?: string | null
          unlinked?: Json
          updated_at?: string
          updated_by?: string | null
          upload_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "contract_send_drafts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contact_sides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_send_drafts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_send_drafts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "hot_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_send_drafts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "lead_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_send_drafts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "match_campaign_founder_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_send_drafts_term_sheet_id_fkey"
            columns: ["term_sheet_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_send_drafts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_template_fields: {
        Row: {
          default_value: string | null
          id: string
          label: string
          position_ref: Json
          required: boolean
          sort_order: number
          template_id: string
          token: string
          type: string
        }
        Insert: {
          default_value?: string | null
          id?: string
          label: string
          position_ref: Json
          required?: boolean
          sort_order?: number
          template_id: string
          token: string
          type: string
        }
        Update: {
          default_value?: string | null
          id?: string
          label?: string
          position_ref?: Json
          required?: boolean
          sort_order?: number
          template_id?: string
          token?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_template_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          created_at: string
          created_by: string | null
          default_entity_id: string | null
          entity_match: string | null
          has_expiry: boolean
          id: string
          key: string
          kind: string
          master_docx: string
          master_filename: string
          name: string
          signature_anchors: Json
          status: string
          subtype: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_entity_id?: string | null
          entity_match?: string | null
          has_expiry?: boolean
          id?: string
          key: string
          kind: string
          master_docx: string
          master_filename: string
          name: string
          signature_anchors: Json
          status?: string
          subtype?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_entity_id?: string | null
          entity_match?: string | null
          has_expiry?: boolean
          id?: string
          key?: string
          kind?: string
          master_docx?: string
          master_filename?: string
          name?: string
          signature_anchors?: Json
          status?: string
          subtype?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_default_entity_id_fkey"
            columns: ["default_entity_id"]
            isOneToOne: false
            referencedRelation: "contract_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      course_coach_config: {
        Row: {
          course_key: string
          data_sources: string[]
          enabled: boolean
          reviewed_hash: string | null
          steps_ready: boolean
          tone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          course_key: string
          data_sources?: string[]
          enabled?: boolean
          reviewed_hash?: string | null
          steps_ready?: boolean
          tone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          course_key?: string
          data_sources?: string[]
          enabled?: boolean
          reviewed_hash?: string | null
          steps_ready?: boolean
          tone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_coach_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_catalog: {
        Row: {
          active: boolean
          cost: number
          created_at: string
          description: string | null
          id: string
          sort: number
          title: string
        }
        Insert: {
          active?: boolean
          cost: number
          created_at?: string
          description?: string | null
          id?: string
          sort?: number
          title: string
        }
        Update: {
          active?: boolean
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          sort?: number
          title?: string
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          created_at: string
          delta: number
          event_id: string | null
          expires_at: string | null
          id: string
          profile_id: string
          reason: string
          redemption_id: string | null
          ref: string
        }
        Insert: {
          created_at?: string
          delta: number
          event_id?: string | null
          expires_at?: string | null
          id?: string
          profile_id: string
          reason: string
          redemption_id?: string | null
          ref?: string
        }
        Update: {
          created_at?: string
          delta?: number
          event_id?: string | null
          expires_at?: string | null
          id?: string
          profile_id?: string
          reason?: string
          redemption_id?: string | null
          ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_redemptions: {
        Row: {
          cost: number
          created_at: string
          id: string
          item_id: string
          profile_id: string
          status: string
          title: string
        }
        Insert: {
          cost: number
          created_at?: string
          id?: string
          item_id: string
          profile_id: string
          status?: string
          title: string
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          item_id?: string
          profile_id?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_redemptions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "credit_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_redemptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contact_annotations: {
        Row: {
          created_at: string
          external_id: string
          id: string
          notes: string | null
          owner: string | null
          source: string
          status: string | null
          tags: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          external_id: string
          id?: string
          notes?: string | null
          owner?: string | null
          source: string
          status?: string | null
          tags?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          external_id?: string
          id?: string
          notes?: string | null
          owner?: string | null
          source?: string
          status?: string | null
          tags?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contact_annotations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          approach: Json | null
          assignee_ids: string[]
          company: string | null
          company_domain: string | null
          contact_confidence: number | null
          contact_type: string | null
          converted: boolean
          country: string | null
          created_on: string | null
          data_source_note: string | null
          email: string | null
          email_source: string | null
          email_status: string | null
          enrichment_status: string | null
          external_id: string
          field_sources: Json
          formd_accession_no: string | null
          formd_cik: string | null
          found_at: string | null
          hidden_from_founders: boolean
          id: string
          inv_source: string | null
          inv_verified_at: string | null
          lawful_basis: string | null
          lead_prescore: number | null
          lead_status: string
          linkedin_slug: string | null
          module: string
          name: string | null
          overrides: Json
          owner: string | null
          owner_id: string | null
          person_search_at: string | null
          phone: string | null
          phone_source: string | null
          plan: string | null
          prescore_dims: Json | null
          profile: Json | null
          profile_v: number
          raw: Json | null
          retention_expires_at: string | null
          segment: string | null
          side: string | null
          side_confidence: number | null
          signals: Json
          source: string
          stage: string | null
          supabase_profile_id: string | null
          suppressed: boolean
          synced_at: string
          tags: string[]
          website: string | null
        }
        Insert: {
          approach?: Json | null
          assignee_ids?: string[]
          company?: string | null
          company_domain?: string | null
          contact_confidence?: number | null
          contact_type?: string | null
          converted?: boolean
          country?: string | null
          created_on?: string | null
          data_source_note?: string | null
          email?: string | null
          email_source?: string | null
          email_status?: string | null
          enrichment_status?: string | null
          external_id: string
          field_sources?: Json
          formd_accession_no?: string | null
          formd_cik?: string | null
          found_at?: string | null
          hidden_from_founders?: boolean
          id?: string
          inv_source?: string | null
          inv_verified_at?: string | null
          lawful_basis?: string | null
          lead_prescore?: number | null
          lead_status?: string
          linkedin_slug?: string | null
          module?: string
          name?: string | null
          overrides?: Json
          owner?: string | null
          owner_id?: string | null
          person_search_at?: string | null
          phone?: string | null
          phone_source?: string | null
          plan?: string | null
          prescore_dims?: Json | null
          profile?: Json | null
          profile_v?: number
          raw?: Json | null
          retention_expires_at?: string | null
          segment?: string | null
          side?: string | null
          side_confidence?: number | null
          signals?: Json
          source: string
          stage?: string | null
          supabase_profile_id?: string | null
          suppressed?: boolean
          synced_at?: string
          tags?: string[]
          website?: string | null
        }
        Update: {
          approach?: Json | null
          assignee_ids?: string[]
          company?: string | null
          company_domain?: string | null
          contact_confidence?: number | null
          contact_type?: string | null
          converted?: boolean
          country?: string | null
          created_on?: string | null
          data_source_note?: string | null
          email?: string | null
          email_source?: string | null
          email_status?: string | null
          enrichment_status?: string | null
          external_id?: string
          field_sources?: Json
          formd_accession_no?: string | null
          formd_cik?: string | null
          found_at?: string | null
          hidden_from_founders?: boolean
          id?: string
          inv_source?: string | null
          inv_verified_at?: string | null
          lawful_basis?: string | null
          lead_prescore?: number | null
          lead_status?: string
          linkedin_slug?: string | null
          module?: string
          name?: string | null
          overrides?: Json
          owner?: string | null
          owner_id?: string | null
          person_search_at?: string | null
          phone?: string | null
          phone_source?: string | null
          plan?: string | null
          prescore_dims?: Json | null
          profile?: Json | null
          profile_v?: number
          raw?: Json | null
          retention_expires_at?: string | null
          segment?: string | null
          side?: string | null
          side_confidence?: number | null
          signals?: Json
          source?: string
          stage?: string | null
          supabase_profile_id?: string | null
          suppressed?: boolean
          synced_at?: string
          tags?: string[]
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contacts_supabase_profile_id_fkey"
            columns: ["supabase_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_facet_cache: {
        Row: {
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          data?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_sync_state: {
        Row: {
          last_cursor: string | null
          last_delta_at: string | null
          last_error: string | null
          last_full_import_at: string | null
          source: string
          total_imported: number
          updated_at: string
        }
        Insert: {
          last_cursor?: string | null
          last_delta_at?: string | null
          last_error?: string | null
          last_full_import_at?: string | null
          source: string
          total_imported?: number
          updated_at?: string
        }
        Update: {
          last_cursor?: string | null
          last_delta_at?: string | null
          last_error?: string | null
          last_full_import_at?: string | null
          source?: string
          total_imported?: number
          updated_at?: string
        }
        Relationships: []
      }
      cron_runs: {
        Row: {
          detail: string | null
          duration_ms: number | null
          finished_at: string | null
          http_status: number | null
          id: number
          job: string
          started_at: string
          status: string
        }
        Insert: {
          detail?: string | null
          duration_ms?: number | null
          finished_at?: string | null
          http_status?: number | null
          id?: number
          job: string
          started_at?: string
          status: string
        }
        Update: {
          detail?: string | null
          duration_ms?: number | null
          finished_at?: string | null
          http_status?: number | null
          id?: number
          job?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      cron_schedule_overrides: {
        Row: {
          cron: string | null
          job: string
          last_dispatch_at: string | null
          next_run_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cron?: string | null
          job: string
          last_dispatch_at?: string | null
          next_run_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cron?: string | null
          job?: string
          last_dispatch_at?: string | null
          next_run_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cron_schedule_overrides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crr_weight_sets: {
        Row: {
          bands: Json
          created_at: string
          created_by: string | null
          factors: Json
          floors: Json
          id: string
          impact: Json | null
          is_active: boolean
          profiles: Json
          reason: string | null
          version: string
        }
        Insert: {
          bands: Json
          created_at?: string
          created_by?: string | null
          factors: Json
          floors: Json
          id?: string
          impact?: Json | null
          is_active?: boolean
          profiles: Json
          reason?: string | null
          version: string
        }
        Update: {
          bands?: Json
          created_at?: string
          created_by?: string | null
          factors?: Json
          floors?: Json
          id?: string
          impact?: Json | null
          is_active?: boolean
          profiles?: Json
          reason?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "crr_weight_sets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_room_access: {
        Row: {
          company_id: string
          created_at: string
          expires_at: string | null
          granted_by: string | null
          id: string
          investor_id: string
          revoked_at: string | null
          scope: string
        }
        Insert: {
          company_id: string
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          investor_id: string
          revoked_at?: string | null
          scope?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          investor_id?: string
          revoked_at?: string | null
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_room_access_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_room_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_room_access_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_room_questions: {
        Row: {
          answer: string | null
          answered_at: string | null
          answered_by: string | null
          company_id: string
          created_at: string
          document_id: string | null
          id: string
          investor_id: string
          question: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          company_id: string
          created_at?: string
          document_id?: string | null
          id?: string
          investor_id: string
          question: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          answered_by?: string | null
          company_id?: string
          created_at?: string
          document_id?: string | null
          id?: string
          investor_id?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_room_questions_answered_by_fkey"
            columns: ["answered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_room_questions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_room_questions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_room_questions_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          at: string
          before: Json | null
          engagement_id: string | null
          id: number
          target: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          engagement_id?: string | null
          id?: never
          target?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          at?: string
          before?: Json | null
          engagement_id?: string | null
          id?: never
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dd_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dd_audit_log_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "dd_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_claims: {
        Row: {
          claim: string
          claimed_value: string | null
          engagement_id: string
          finding_id: string | null
          id: string
          source_asserted: string | null
          verification: string
          weight: number
        }
        Insert: {
          claim: string
          claimed_value?: string | null
          engagement_id: string
          finding_id?: string | null
          id?: string
          source_asserted?: string | null
          verification?: string
          weight?: number
        }
        Update: {
          claim?: string
          claimed_value?: string | null
          engagement_id?: string
          finding_id?: string | null
          id?: string
          source_asserted?: string | null
          verification?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "dd_claims_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "dd_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dd_claims_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "dd_findings"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_conditions: {
        Row: {
          detail: string | null
          engagement_id: string
          id: string
          label: string
          sort_order: number | null
          status: string
        }
        Insert: {
          detail?: string | null
          engagement_id: string
          id?: string
          label: string
          sort_order?: number | null
          status?: string
        }
        Update: {
          detail?: string | null
          engagement_id?: string
          id?: string
          label?: string
          sort_order?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "dd_conditions_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "dd_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_consent_envelopes: {
        Row: {
          certificate_path: string | null
          completed_at: string | null
          created_at: string
          engagement_id: string
          id: string
          provider: string
          signature_request_id: string | null
          signers: Json
          status: string
          version_id: string | null
        }
        Insert: {
          certificate_path?: string | null
          completed_at?: string | null
          created_at?: string
          engagement_id: string
          id?: string
          provider?: string
          signature_request_id?: string | null
          signers?: Json
          status?: string
          version_id?: string | null
        }
        Update: {
          certificate_path?: string | null
          completed_at?: string | null
          created_at?: string
          engagement_id?: string
          id?: string
          provider?: string
          signature_request_id?: string | null
          signers?: Json
          status?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dd_consent_envelopes_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "dd_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dd_consent_envelopes_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "dd_report_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_doc_requests: {
        Row: {
          category: string
          closes_findings: string[]
          document_id: string | null
          due_date: string | null
          engagement_id: string
          id: string
          label: string
          owner_role: string | null
          status: string
        }
        Insert: {
          category: string
          closes_findings?: string[]
          document_id?: string | null
          due_date?: string | null
          engagement_id: string
          id?: string
          label: string
          owner_role?: string | null
          status?: string
        }
        Update: {
          category?: string
          closes_findings?: string[]
          document_id?: string | null
          due_date?: string | null
          engagement_id?: string
          id?: string
          label?: string
          owner_role?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "dd_doc_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "dd_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dd_doc_requests_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "dd_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_documents: {
        Row: {
          engagement_id: string
          filename: string
          id: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          engagement_id: string
          filename: string
          id?: string
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          engagement_id?: string
          filename?: string
          id?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dd_documents_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "dd_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dd_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_domains: {
        Row: {
          code: string
          conclusion: string | null
          engagement_id: string
          id: string
          mitigation: Json
          name: string
          overview: string | null
          risk_rating: string | null
          sort_order: number | null
          strengths: Json
        }
        Insert: {
          code: string
          conclusion?: string | null
          engagement_id: string
          id?: string
          mitigation?: Json
          name: string
          overview?: string | null
          risk_rating?: string | null
          sort_order?: number | null
          strengths?: Json
        }
        Update: {
          code?: string
          conclusion?: string | null
          engagement_id?: string
          id?: string
          mitigation?: Json
          name?: string
          overview?: string | null
          risk_rating?: string | null
          sort_order?: number | null
          strengths?: Json
        }
        Relationships: [
          {
            foreignKeyName: "dd_domains_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "dd_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_engagement_members: {
        Row: {
          created_at: string
          engagement_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          engagement_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          engagement_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dd_engagement_members_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "dd_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dd_engagement_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_engagements: {
        Row: {
          company_id: string | null
          company_name: string
          company_slug: string
          confidence_pct: number
          created_at: string
          id: string
          lifecycle_stage: string
          owner_id: string | null
          posture: string | null
          recommendation: string | null
          report_code: string
          round_label: string | null
          sector: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          company_name: string
          company_slug: string
          confidence_pct?: number
          created_at?: string
          id?: string
          lifecycle_stage?: string
          owner_id?: string | null
          posture?: string | null
          recommendation?: string | null
          report_code: string
          round_label?: string | null
          sector?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          company_name?: string
          company_slug?: string
          confidence_pct?: number
          created_at?: string
          id?: string
          lifecycle_stage?: string
          owner_id?: string | null
          posture?: string | null
          recommendation?: string | null
          report_code?: string
          round_label?: string | null
          sector?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dd_engagements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dd_engagements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_findings: {
        Row: {
          created_at: string
          detail: string | null
          domain_id: string | null
          engagement_id: string
          finding_code: string
          id: string
          internal_note: string | null
          severity: string
          source: string | null
          status: string
          title: string
          verification: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          domain_id?: string | null
          engagement_id: string
          finding_code: string
          id?: string
          internal_note?: string | null
          severity: string
          source?: string | null
          status?: string
          title: string
          verification?: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          domain_id?: string | null
          engagement_id?: string
          finding_code?: string
          id?: string
          internal_note?: string | null
          severity?: string
          source?: string | null
          status?: string
          title?: string
          verification?: string
        }
        Relationships: [
          {
            foreignKeyName: "dd_findings_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "dd_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dd_findings_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "dd_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_report_versions: {
        Row: {
          created_at: string
          document_hash: string | null
          engagement_id: string
          id: string
          pdf_path: string | null
          snapshot: Json
          status: string
          version: string
        }
        Insert: {
          created_at?: string
          document_hash?: string | null
          engagement_id: string
          id?: string
          pdf_path?: string | null
          snapshot: Json
          status?: string
          version: string
        }
        Update: {
          created_at?: string
          document_hash?: string | null
          engagement_id?: string
          id?: string
          pdf_path?: string | null
          snapshot?: Json
          status?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "dd_report_versions_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "dd_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_responses: {
        Row: {
          body: string
          disposition: string
          due_date: string | null
          engagement_id: string
          evidence_doc_id: string | null
          finding_codes: string[]
          icfo_review: string
          id: string
          locked: boolean
          owner_role: string | null
          submitted_at: string | null
          submitted_by: string | null
        }
        Insert: {
          body: string
          disposition: string
          due_date?: string | null
          engagement_id: string
          evidence_doc_id?: string | null
          finding_codes: string[]
          icfo_review?: string
          id?: string
          locked?: boolean
          owner_role?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
        }
        Update: {
          body?: string
          disposition?: string
          due_date?: string | null
          engagement_id?: string
          evidence_doc_id?: string | null
          finding_codes?: string[]
          icfo_review?: string
          id?: string
          locked?: boolean
          owner_role?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dd_responses_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "dd_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dd_responses_evidence_doc_id_fkey"
            columns: ["evidence_doc_id"]
            isOneToOne: false
            referencedRelation: "dd_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dd_responses_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dd_visibility_gate: {
        Row: {
          engagement_id: string
          founder_visible: boolean
          investor_visible: boolean
          section: string
        }
        Insert: {
          engagement_id: string
          founder_visible?: boolean
          investor_visible?: boolean
          section: string
        }
        Update: {
          engagement_id?: string
          founder_visible?: boolean
          investor_visible?: boolean
          section?: string
        }
        Relationships: [
          {
            foreignKeyName: "dd_visibility_gate_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "dd_engagements"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_room_activity_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          room_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          room_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_room_activity_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_room_activity_events_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "deal_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_room_document_requests: {
        Row: {
          created_at: string
          custom_request: string | null
          founder_note: string | null
          fulfilled_at: string | null
          fulfilled_document_id: string | null
          id: string
          request_type: string
          requested_by_user_id: string
          room_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_request?: string | null
          founder_note?: string | null
          fulfilled_at?: string | null
          fulfilled_document_id?: string | null
          id?: string
          request_type: string
          requested_by_user_id: string
          room_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_request?: string | null
          founder_note?: string | null
          fulfilled_at?: string | null
          fulfilled_document_id?: string | null
          id?: string
          request_type?: string
          requested_by_user_id?: string
          room_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_room_document_requests_fulfilled_document_id_fkey"
            columns: ["fulfilled_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_room_document_requests_requested_by_user_id_fkey"
            columns: ["requested_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_room_document_requests_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "deal_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_room_questions: {
        Row: {
          asked_by_user_id: string
          category: string
          created_at: string
          founder_response: string | null
          id: string
          question: string
          resolved_at: string | null
          responded_at: string | null
          room_id: string
          status: string
          updated_at: string
        }
        Insert: {
          asked_by_user_id: string
          category?: string
          created_at?: string
          founder_response?: string | null
          id?: string
          question: string
          resolved_at?: string | null
          responded_at?: string | null
          room_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          asked_by_user_id?: string
          category?: string
          created_at?: string
          founder_response?: string | null
          id?: string
          question?: string
          resolved_at?: string | null
          responded_at?: string | null
          room_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_room_questions_asked_by_user_id_fkey"
            columns: ["asked_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_room_questions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "deal_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_rooms: {
        Row: {
          campaign_id: string | null
          company_id: string
          created_at: string
          founder_id: string
          id: string
          investor_profile_id: string
          investor_user_id: string
          spv_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          company_id: string
          created_at?: string
          founder_id: string
          id?: string
          investor_profile_id: string
          investor_user_id: string
          spv_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          company_id?: string
          created_at?: string
          founder_id?: string
          id?: string
          investor_profile_id?: string
          investor_user_id?: string
          spv_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_rooms_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_rooms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_rooms_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_rooms_investor_profile_id_fkey"
            columns: ["investor_profile_id"]
            isOneToOne: false
            referencedRelation: "investor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_rooms_investor_user_id_fkey"
            columns: ["investor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_rooms_spv_id_fkey"
            columns: ["spv_id"]
            isOneToOne: false
            referencedRelation: "spv_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      department_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          department_id: string | null
          detail: Json | null
          feature_id: string | null
          id: number
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          department_id?: string | null
          detail?: Json | null
          feature_id?: string | null
          id?: never
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          department_id?: string | null
          detail?: Json | null
          feature_id?: string | null
          id?: never
          target_user_id?: string | null
        }
        Relationships: []
      }
      department_features: {
        Row: {
          department_id: string
          enabled: boolean
          feature_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          department_id: string
          enabled?: boolean
          feature_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          department_id?: string
          enabled?: boolean
          feature_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "department_features_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
        ]
      }
      department_members: {
        Row: {
          added_by: string | null
          created_at: string
          department_id: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          department_id: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          department_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_members_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          contacts_see_all: boolean
          created_at: string
          hub_key: string
          id: string
          is_active: boolean
          is_admin: boolean
          key: string
          name: string
        }
        Insert: {
          contacts_see_all?: boolean
          created_at?: string
          hub_key: string
          id?: string
          is_active?: boolean
          is_admin?: boolean
          key: string
          name: string
        }
        Update: {
          contacts_see_all?: boolean
          created_at?: string
          hub_key?: string
          id?: string
          is_active?: boolean
          is_admin?: boolean
          key?: string
          name?: string
        }
        Relationships: []
      }
      dev_build_io: {
        Row: {
          body: string
          created_at: string
          id: number
          kind: string
          name: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: number
          kind: string
          name?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: number
          kind?: string
          name?: string | null
        }
        Relationships: []
      }
      dev_patch_queue: {
        Row: {
          applied_at: string | null
          applied_sha: string | null
          created_at: string
          id: number
          patch: string
          result: string | null
          status: string
          title: string
        }
        Insert: {
          applied_at?: string | null
          applied_sha?: string | null
          created_at?: string
          id?: number
          patch: string
          result?: string | null
          status?: string
          title: string
        }
        Update: {
          applied_at?: string | null
          applied_sha?: string | null
          created_at?: string
          id?: number
          patch?: string
          result?: string | null
          status?: string
          title?: string
        }
        Relationships: []
      }
      diligence_report_share_views: {
        Row: {
          action: string
          id: string
          share_id: string
          viewed_at: string
        }
        Insert: {
          action?: string
          id?: string
          share_id: string
          viewed_at?: string
        }
        Update: {
          action?: string
          id?: string
          share_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diligence_report_share_views_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "diligence_report_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      diligence_report_shares: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          revoked_at: string | null
          token: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          revoked_at?: string | null
          token: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "diligence_report_shares_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diligence_report_shares_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      diligence_reports: {
        Row: {
          business_overview: string | null
          company_id: string | null
          created_at: string | null
          executive_summary: string | null
          financial_review: string | null
          id: string
          legal_review: string | null
          market_review: string | null
          missing_documents: Json | null
          org_id: string | null
          readiness_score: number | null
          recommendations: string | null
          risk_flags: Json | null
          team_review: string | null
        }
        Insert: {
          business_overview?: string | null
          company_id?: string | null
          created_at?: string | null
          executive_summary?: string | null
          financial_review?: string | null
          id?: string
          legal_review?: string | null
          market_review?: string | null
          missing_documents?: Json | null
          org_id?: string | null
          readiness_score?: number | null
          recommendations?: string | null
          risk_flags?: Json | null
          team_review?: string | null
        }
        Update: {
          business_overview?: string | null
          company_id?: string | null
          created_at?: string | null
          executive_summary?: string | null
          financial_review?: string | null
          id?: string
          legal_review?: string | null
          market_review?: string | null
          missing_documents?: Json | null
          org_id?: string | null
          readiness_score?: number | null
          recommendations?: string | null
          risk_flags?: Json | null
          team_review?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diligence_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diligence_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dnc_list: {
        Row: {
          added_at: string
          id: string
          number: string
          reason: string | null
          scope: string
        }
        Insert: {
          added_at?: string
          id?: string
          number: string
          reason?: string | null
          scope?: string
        }
        Update: {
          added_at?: string
          id?: string
          number?: string
          reason?: string | null
          scope?: string
        }
        Relationships: []
      }
      document_not_applicable: {
        Row: {
          company_id: string
          created_at: string
          document_type: string
          id: string
          marked_by: string | null
          reason: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          document_type: string
          id?: string
          marked_by?: string | null
          reason?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          document_type?: string
          id?: string
          marked_by?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_not_applicable_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          ai_summary: string | null
          company_id: string | null
          created_at: string | null
          document_type: string | null
          file_name: string | null
          file_path: string | null
          file_url: string | null
          id: string
          is_approved: boolean | null
          label: string | null
          mime_type: string | null
          org_id: string | null
          size_bytes: number | null
          status: string | null
          uploaded_by: string | null
        }
        Insert: {
          ai_summary?: string | null
          company_id?: string | null
          created_at?: string | null
          document_type?: string | null
          file_name?: string | null
          file_path?: string | null
          file_url?: string | null
          id?: string
          is_approved?: boolean | null
          label?: string | null
          mime_type?: string | null
          org_id?: string | null
          size_bytes?: number | null
          status?: string | null
          uploaded_by?: string | null
        }
        Update: {
          ai_summary?: string | null
          company_id?: string | null
          created_at?: string | null
          document_type?: string | null
          file_name?: string | null
          file_path?: string | null
          file_url?: string | null
          id?: string
          is_approved?: boolean | null
          label?: string | null
          mime_type?: string | null
          org_id?: string | null
          size_bytes?: number | null
          status?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_domain_patterns: {
        Row: {
          catch_all: boolean | null
          conflicting_samples: number
          domain: string
          format_counts: Json
          last_checked_at: string
          pattern: string
          role_inbox: string | null
          verified_samples: number
        }
        Insert: {
          catch_all?: boolean | null
          conflicting_samples?: number
          domain: string
          format_counts?: Json
          last_checked_at?: string
          pattern: string
          role_inbox?: string | null
          verified_samples?: number
        }
        Update: {
          catch_all?: boolean | null
          conflicting_samples?: number
          domain?: string
          format_counts?: Json
          last_checked_at?: string
          pattern?: string
          role_inbox?: string | null
          verified_samples?: number
        }
        Relationships: []
      }
      email_drafts: {
        Row: {
          attachments: Json
          body: string | null
          created_at: string
          id: string
          owner_id: string
          subject: string | null
          to_email: string | null
          updated_at: string
        }
        Insert: {
          attachments?: Json
          body?: string | null
          created_at?: string
          id?: string
          owner_id: string
          subject?: string | null
          to_email?: string | null
          updated_at?: string
        }
        Update: {
          attachments?: Json
          body?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          subject?: string | null
          to_email?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_drafts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          body_html: string | null
          body_text: string | null
          bounced_at: string | null
          clicked_at: string | null
          complained_at: string | null
          created_at: string
          delivered_at: string | null
          error: string | null
          id: number
          job: string | null
          last_event: string | null
          last_event_at: string | null
          opened_at: string | null
          provider_id: string | null
          recipient_role: string
          recipient_user_id: string | null
          run_id: number | null
          source: string
          status: string
          subject: string
          to_email: string
          triggered_by: string | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          bounced_at?: string | null
          clicked_at?: string | null
          complained_at?: string | null
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          id?: number
          job?: string | null
          last_event?: string | null
          last_event_at?: string | null
          opened_at?: string | null
          provider_id?: string | null
          recipient_role?: string
          recipient_user_id?: string | null
          run_id?: number | null
          source?: string
          status: string
          subject: string
          to_email: string
          triggered_by?: string | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          bounced_at?: string | null
          clicked_at?: string | null
          complained_at?: string | null
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          id?: number
          job?: string | null
          last_event?: string | null
          last_event_at?: string | null
          opened_at?: string | null
          provider_id?: string | null
          recipient_role?: string
          recipient_user_id?: string | null
          run_id?: number | null
          source?: string
          status?: string
          subject?: string
          to_email?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_log_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_messages: {
        Row: {
          attachments: Json
          body_html: string | null
          body_text: string | null
          created_at: string
          direction: string
          from_email: string
          from_name: string | null
          id: string
          owner_id: string
          provider_id: string | null
          subject: string | null
          thread_id: string
          to_email: string
        }
        Insert: {
          attachments?: Json
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          direction: string
          from_email: string
          from_name?: string | null
          id?: string
          owner_id: string
          provider_id?: string | null
          subject?: string | null
          thread_id: string
          to_email: string
        }
        Update: {
          attachments?: Json
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          direction?: string
          from_email?: string
          from_name?: string | null
          id?: string
          owner_id?: string
          provider_id?: string | null
          subject?: string | null
          thread_id?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "email_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_template_copies: {
        Row: {
          banner_image_url: string | null
          banner_mode: string
          campaign_group_id: string | null
          created_at: string
          created_by: string | null
          footer_note: string | null
          id: string
          master_id: string
          name: string
          slot_values: Json
          status: string
          updated_at: string
        }
        Insert: {
          banner_image_url?: string | null
          banner_mode?: string
          campaign_group_id?: string | null
          created_at?: string
          created_by?: string | null
          footer_note?: string | null
          id?: string
          master_id: string
          name: string
          slot_values?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          banner_image_url?: string | null
          banner_mode?: string
          campaign_group_id?: string | null
          created_at?: string
          created_by?: string | null
          footer_note?: string | null
          id?: string
          master_id?: string
          name?: string
          slot_values?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_template_copies_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "email_template_masters"
            referencedColumns: ["id"]
          },
        ]
      }
      email_template_masters: {
        Row: {
          compiled_html: string
          created_at: string
          description: string | null
          id: string
          mjml_source: string
          name: string
          placeholder_schema: Json
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          compiled_html: string
          created_at?: string
          description?: string | null
          id?: string
          mjml_source: string
          name: string
          placeholder_schema: Json
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          compiled_html?: string
          created_at?: string
          description?: string | null
          id?: string
          mjml_source?: string
          name?: string
          placeholder_schema?: Json
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_threads: {
        Row: {
          contact_email: string
          contact_name: string | null
          created_at: string
          id: string
          last_direction: string | null
          last_message_at: string
          owner_id: string
          reply_token: string
          spam_at: string | null
          subject: string | null
          trashed_at: string | null
          unread: boolean
          updated_at: string
        }
        Insert: {
          contact_email: string
          contact_name?: string | null
          created_at?: string
          id?: string
          last_direction?: string | null
          last_message_at?: string
          owner_id: string
          reply_token: string
          spam_at?: string | null
          subject?: string | null
          trashed_at?: string | null
          unread?: boolean
          updated_at?: string
        }
        Update: {
          contact_email?: string
          contact_name?: string | null
          created_at?: string
          id?: string
          last_direction?: string | null
          last_message_at?: string
          owner_id?: string
          reply_token?: string
          spam_at?: string | null
          subject?: string | null
          trashed_at?: string | null
          unread?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_threads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_activity: {
        Row: {
          actor_id: string | null
          created_at: string
          event_id: string
          event_type: string
          id: string
          payload: Json
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          payload?: Json
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "event_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_activity_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_banned_attendees: {
        Row: {
          banned_by: string | null
          created_at: string
          event_id: string
          permanent: boolean
          profile_id: string
        }
        Insert: {
          banned_by?: string | null
          created_at?: string
          event_id: string
          permanent?: boolean
          profile_id: string
        }
        Update: {
          banned_by?: string | null
          created_at?: string
          event_id?: string
          permanent?: boolean
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_banned_attendees_banned_by_fkey"
            columns: ["banned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_banned_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_banned_attendees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_brochures: {
        Row: {
          base_edition_id: string | null
          cover_thumb_path: string | null
          created_at: string
          created_by: string | null
          event_id: string | null
          generated_at: string | null
          id: string
          merge_snapshot: Json | null
          overrides: Json
          page_config: Json
          pdf_digital_path: string | null
          pdf_print_path: string | null
          published: boolean
          published_at: string | null
          size: string
          status: string
          theme: string
          title: string
          updated_at: string
        }
        Insert: {
          base_edition_id?: string | null
          cover_thumb_path?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          generated_at?: string | null
          id?: string
          merge_snapshot?: Json | null
          overrides?: Json
          page_config?: Json
          pdf_digital_path?: string | null
          pdf_print_path?: string | null
          published?: boolean
          published_at?: string | null
          size?: string
          status?: string
          theme?: string
          title: string
          updated_at?: string
        }
        Update: {
          base_edition_id?: string | null
          cover_thumb_path?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          generated_at?: string | null
          id?: string
          merge_snapshot?: Json | null
          overrides?: Json
          page_config?: Json
          pdf_digital_path?: string | null
          pdf_print_path?: string | null
          published?: boolean
          published_at?: string | null
          size?: string
          status?: string
          theme?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_brochures_base_edition_id_fkey"
            columns: ["base_edition_id"]
            isOneToOne: false
            referencedRelation: "event_brochures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_brochures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_brochures_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_email_drafts: {
        Row: {
          blocks: Json | null
          created_at: string
          email_type: string
          event_id: string
          id: string
          include_banner: boolean | null
          include_lobby: boolean | null
          include_roster: boolean
          subject: string | null
          theme: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          blocks?: Json | null
          created_at?: string
          email_type: string
          event_id: string
          id?: string
          include_banner?: boolean | null
          include_lobby?: boolean | null
          include_roster?: boolean
          subject?: string | null
          theme?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          blocks?: Json | null
          created_at?: string
          email_type?: string
          event_id?: string
          id?: string
          include_banner?: boolean | null
          include_lobby?: boolean | null
          include_roster?: boolean
          subject?: string | null
          theme?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_email_drafts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_email_drafts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_help_requests: {
        Row: {
          created_at: string
          event_id: string
          id: string
          message: string
          profile_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          message: string
          profile_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          message?: string
          profile_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_help_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_help_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_help_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_intro_templates: {
        Row: {
          body: string
          kind: string
          subject: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body: string
          kind: string
          subject: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          kind?: string
          subject?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_intro_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_introductions: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          follow_ups: number
          founder_reg_id: string
          founder_reminders: number
          id: string
          investor_reg_id: string
          last_follow_up_at: string | null
          last_founder_reminder_at: string | null
          meeting_url: string | null
          reschedule_note: string | null
          reschedule_requested_at: string | null
          responded_at: string | null
          room_expires_at: string | null
          room_url: string | null
          scheduled_at: string | null
          scheduled_by: string | null
          scheduled_end: string | null
          scheduled_set_at: string | null
          score: number
          sent_at: string
          sent_via: string
          shared_sectors: string[]
          status: Database["public"]["Enums"]["introduction_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          follow_ups?: number
          founder_reg_id: string
          founder_reminders?: number
          id?: string
          investor_reg_id: string
          last_follow_up_at?: string | null
          last_founder_reminder_at?: string | null
          meeting_url?: string | null
          reschedule_note?: string | null
          reschedule_requested_at?: string | null
          responded_at?: string | null
          room_expires_at?: string | null
          room_url?: string | null
          scheduled_at?: string | null
          scheduled_by?: string | null
          scheduled_end?: string | null
          scheduled_set_at?: string | null
          score?: number
          sent_at?: string
          sent_via?: string
          shared_sectors?: string[]
          status?: Database["public"]["Enums"]["introduction_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          follow_ups?: number
          founder_reg_id?: string
          founder_reminders?: number
          id?: string
          investor_reg_id?: string
          last_follow_up_at?: string | null
          last_founder_reminder_at?: string | null
          meeting_url?: string | null
          reschedule_note?: string | null
          reschedule_requested_at?: string | null
          responded_at?: string | null
          room_expires_at?: string | null
          room_url?: string | null
          scheduled_at?: string | null
          scheduled_by?: string | null
          scheduled_end?: string | null
          scheduled_set_at?: string | null
          score?: number
          sent_at?: string
          sent_via?: string
          shared_sectors?: string[]
          status?: Database["public"]["Enums"]["introduction_status"]
        }
        Relationships: [
          {
            foreignKeyName: "event_introductions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_introductions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_introductions_founder_reg_id_fkey"
            columns: ["founder_reg_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_introductions_investor_reg_id_fkey"
            columns: ["investor_reg_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_introductions_scheduled_by_fkey"
            columns: ["scheduled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_invitation_campaigns: {
        Row: {
          audiences: Json
          created_at: string
          created_by: string | null
          event_ids: string[]
          from_email: string | null
          from_name: string
          id: string
          name: string
          schedule_at: string | null
          scheduled_by: string | null
          stats_settings: Json
          status: string
          updated_at: string
        }
        Insert: {
          audiences?: Json
          created_at?: string
          created_by?: string | null
          event_ids?: string[]
          from_email?: string | null
          from_name?: string
          id?: string
          name: string
          schedule_at?: string | null
          scheduled_by?: string | null
          stats_settings?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          audiences?: Json
          created_at?: string
          created_by?: string | null
          event_ids?: string[]
          from_email?: string | null
          from_name?: string
          id?: string
          name?: string
          schedule_at?: string | null
          scheduled_by?: string | null
          stats_settings?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_invitation_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invitation_campaigns_scheduled_by_fkey"
            columns: ["scheduled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_invitation_sends: {
        Row: {
          created_at: string
          error: string | null
          id: string
          invitation_id: string | null
          kind: string
          ok: boolean
          registration_id: string | null
          resend_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          invitation_id?: string | null
          kind: string
          ok?: boolean
          registration_id?: string | null
          resend_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          invitation_id?: string | null
          kind?: string
          ok?: boolean
          registration_id?: string | null
          resend_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_invitation_sends_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "event_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invitation_sends_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_invitations: {
        Row: {
          campaign_id: string
          company: string | null
          created_at: string
          crm_contact_id: string | null
          email: string
          first_name: string | null
          first_sent_at: string | null
          id: string
          last_sent_at: string | null
          marketing_contact_id: string | null
          opened_at: string | null
          registered_event_ids: string[]
          role: string
          status: string
          steps_sent: string[]
          stopped_reason: string | null
          token_hash: string
        }
        Insert: {
          campaign_id: string
          company?: string | null
          created_at?: string
          crm_contact_id?: string | null
          email: string
          first_name?: string | null
          first_sent_at?: string | null
          id?: string
          last_sent_at?: string | null
          marketing_contact_id?: string | null
          opened_at?: string | null
          registered_event_ids?: string[]
          role: string
          status?: string
          steps_sent?: string[]
          stopped_reason?: string | null
          token_hash: string
        }
        Update: {
          campaign_id?: string
          company?: string | null
          created_at?: string
          crm_contact_id?: string | null
          email?: string
          first_name?: string | null
          first_sent_at?: string | null
          id?: string
          last_sent_at?: string | null
          marketing_contact_id?: string | null
          opened_at?: string | null
          registered_event_ids?: string[]
          role?: string
          status?: string
          steps_sent?: string[]
          stopped_reason?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_invitations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "event_invitation_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      event_leads: {
        Row: {
          answers: Json
          company: string | null
          created_at: string
          event_id: string
          id: string
          lead_type: string
          profile_id: string | null
          status: string
        }
        Insert: {
          answers?: Json
          company?: string | null
          created_at?: string
          event_id: string
          id?: string
          lead_type: string
          profile_id?: string | null
          status?: string
        }
        Update: {
          answers?: Json
          company?: string | null
          created_at?: string
          event_id?: string
          id?: string
          lead_type?: string
          profile_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_leads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_leads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_marketing: {
        Row: {
          brochure: Json
          created_at: string
          email_invite: Json
          event_id: string
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          social: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          brochure?: Json
          created_at?: string
          email_invite?: Json
          event_id: string
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          social?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          brochure?: Json
          created_at?: string
          email_invite?: Json
          event_id?: string
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          social?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_marketing_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_marketing_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_matching_rules: {
        Row: {
          event_id: string
          pair_types: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          event_id: string
          pair_types?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          event_id?: string
          pair_types?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_matching_rules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_matching_rules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_missions: {
        Row: {
          bonus_points: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          required_actions: string[]
          title: string
          updated_at: string
        }
        Insert: {
          bonus_points?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          required_actions?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          bonus_points?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          required_actions?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_moderation_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          event_id: string
          id: string
          metadata: Json
          target: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          event_id: string
          id?: string
          metadata?: Json
          target?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          event_id?: string
          id?: string
          metadata?: Json
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_moderation_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_moderation_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_moderators: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          event_id: string
          id: string
          rooms: string[]
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          event_id: string
          id?: string
          rooms?: string[]
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          event_id?: string
          id?: string
          rooms?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_moderators_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_moderators_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_moderators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_muted_attendees: {
        Row: {
          created_at: string
          event_id: string
          muted_by: string | null
          profile_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          muted_by?: string | null
          profile_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          muted_by?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_muted_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_muted_attendees_muted_by_fkey"
            columns: ["muted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_muted_attendees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_point_rules: {
        Row: {
          action: string
          points: number
          updated_at: string
        }
        Insert: {
          action: string
          points?: number
          updated_at?: string
        }
        Update: {
          action?: string
          points?: number
          updated_at?: string
        }
        Relationships: []
      }
      event_points: {
        Row: {
          action: string
          created_at: string
          event_id: string
          id: string
          points: number
          profile_id: string
          ref: string
        }
        Insert: {
          action: string
          created_at?: string
          event_id: string
          id?: string
          points?: number
          profile_id: string
          ref?: string
        }
        Update: {
          action?: string
          created_at?: string
          event_id?: string
          id?: string
          points?: number
          profile_id?: string
          ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_points_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_points_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_poll_votes: {
        Row: {
          created_at: string
          option_index: number
          poll_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          option_index: number
          poll_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          option_index?: number
          poll_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "event_polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_poll_votes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_polls: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          is_open: boolean
          options: Json
          question: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          is_open?: boolean
          options?: Json
          question: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          is_open?: boolean
          options?: Json
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_polls_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_presenter_invites: {
        Row: {
          created_at: string
          decline_reason: string | null
          display_name: string | null
          email: string
          event_id: string
          id: string
          invited_at: string
          invited_by: string | null
          kind: Database["public"]["Enums"]["speaker_application_kind"]
          last_reminded_at: string | null
          materials_due: string | null
          note: string | null
          presenter_id: string | null
          profile_id: string | null
          responded_at: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["event_invite_status"]
          token_nonce: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decline_reason?: string | null
          display_name?: string | null
          email: string
          event_id: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          kind: Database["public"]["Enums"]["speaker_application_kind"]
          last_reminded_at?: string | null
          materials_due?: string | null
          note?: string | null
          presenter_id?: string | null
          profile_id?: string | null
          responded_at?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["event_invite_status"]
          token_nonce?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decline_reason?: string | null
          display_name?: string | null
          email?: string
          event_id?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          kind?: Database["public"]["Enums"]["speaker_application_kind"]
          last_reminded_at?: string | null
          materials_due?: string | null
          note?: string | null
          presenter_id?: string | null
          profile_id?: string | null
          responded_at?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["event_invite_status"]
          token_nonce?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_presenter_invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_presenter_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_presenter_invites_presenter_id_fkey"
            columns: ["presenter_id"]
            isOneToOne: false
            referencedRelation: "event_presenters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_presenter_invites_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_presenter_invites_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      event_presenters: {
        Row: {
          ai_intro: string | null
          application_id: string | null
          bio: string | null
          booth_sponsor_id: string | null
          company_logo_path: string | null
          company_summary: string | null
          created_at: string
          deck_bytes: number | null
          deck_filename: string | null
          deck_path: string | null
          display_name: string
          email: string | null
          event_id: string
          headline: string | null
          headshot_path: string | null
          id: string
          links: Json
          materials_updated_at: string | null
          meeting_url: string | null
          position: number
          profile_id: string | null
          role_label: string | null
          session_id: string | null
          starts_at: string | null
          timezone: string | null
          video_url: string | null
          youtube_video_id: string | null
        }
        Insert: {
          ai_intro?: string | null
          application_id?: string | null
          bio?: string | null
          booth_sponsor_id?: string | null
          company_logo_path?: string | null
          company_summary?: string | null
          created_at?: string
          deck_bytes?: number | null
          deck_filename?: string | null
          deck_path?: string | null
          display_name: string
          email?: string | null
          event_id: string
          headline?: string | null
          headshot_path?: string | null
          id?: string
          links?: Json
          materials_updated_at?: string | null
          meeting_url?: string | null
          position?: number
          profile_id?: string | null
          role_label?: string | null
          session_id?: string | null
          starts_at?: string | null
          timezone?: string | null
          video_url?: string | null
          youtube_video_id?: string | null
        }
        Update: {
          ai_intro?: string | null
          application_id?: string | null
          bio?: string | null
          booth_sponsor_id?: string | null
          company_logo_path?: string | null
          company_summary?: string | null
          created_at?: string
          deck_bytes?: number | null
          deck_filename?: string | null
          deck_path?: string | null
          display_name?: string
          email?: string | null
          event_id?: string
          headline?: string | null
          headshot_path?: string | null
          id?: string
          links?: Json
          materials_updated_at?: string | null
          meeting_url?: string | null
          position?: number
          profile_id?: string | null
          role_label?: string | null
          session_id?: string | null
          starts_at?: string | null
          timezone?: string | null
          video_url?: string | null
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_presenters_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "speaker_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_presenters_booth_sponsor_id_fkey"
            columns: ["booth_sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_presenters_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_presenters_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_presenters_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      event_sectors: {
        Row: {
          created_at: string
          event_id: string
          id: string
          label: string
          sector_slug: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          label: string
          sector_slug: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          label?: string
          sector_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_sectors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_sponsors: {
        Row: {
          created_at: string
          event_id: string
          id: string
          placement: Database["public"]["Enums"]["event_sponsor_placement"]
          sponsor_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          placement?: Database["public"]["Enums"]["event_sponsor_placement"]
          sponsor_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          placement?: Database["public"]["Enums"]["event_sponsor_placement"]
          sponsor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_sponsors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_sponsors_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          banner_bg: string
          banner_html: string | null
          banner_title: string | null
          cover_focal: string
          cover_overlay: number
          cover_path: string | null
          created_at: string
          created_by: string
          ends_at: string | null
          format: Database["public"]["Enums"]["event_format"]
          id: string
          lobby_background_path: string | null
          organizer_email: string | null
          organizer_name: string | null
          organizer_phone: string | null
          published_at: string | null
          show_countdown: boolean
          slug: string
          starts_at: string | null
          status: Database["public"]["Enums"]["event_status"]
          summary: string | null
          timezone: string | null
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["event_visibility"]
        }
        Insert: {
          banner_bg?: string
          banner_html?: string | null
          banner_title?: string | null
          cover_focal?: string
          cover_overlay?: number
          cover_path?: string | null
          created_at?: string
          created_by: string
          ends_at?: string | null
          format?: Database["public"]["Enums"]["event_format"]
          id?: string
          lobby_background_path?: string | null
          organizer_email?: string | null
          organizer_name?: string | null
          organizer_phone?: string | null
          published_at?: string | null
          show_countdown?: boolean
          slug: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          summary?: string | null
          timezone?: string | null
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["event_visibility"]
        }
        Update: {
          banner_bg?: string
          banner_html?: string | null
          banner_title?: string | null
          cover_focal?: string
          cover_overlay?: number
          cover_path?: string | null
          created_at?: string
          created_by?: string
          ends_at?: string | null
          format?: Database["public"]["Enums"]["event_format"]
          id?: string
          lobby_background_path?: string | null
          organizer_email?: string | null
          organizer_name?: string | null
          organizer_phone?: string | null
          published_at?: string | null
          show_countdown?: boolean
          slug?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          summary?: string | null
          timezone?: string | null
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["event_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          audience: string
          enabled: boolean
          feature: string
          updated_at: string
        }
        Insert: {
          audience: string
          enabled?: boolean
          feature: string
          updated_at?: string
        }
        Update: {
          audience?: string
          enabled?: boolean
          feature?: string
          updated_at?: string
        }
        Relationships: []
      }
      features: {
        Row: {
          created_at: string
          hub_key: string
          id: string
          is_active: boolean
          key: string
          label: string
          path: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          hub_key: string
          id?: string
          is_active?: boolean
          key: string
          label: string
          path: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          hub_key?: string
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          path?: string
          sort_order?: number
        }
        Relationships: []
      }
      fit_sessions: {
        Row: {
          created_at: string
          email: string | null
          id: string
          industry: string | null
          last_step: number
          match_snapshot: Json | null
          matched_count: number | null
          raise: string | null
          revenue: string | null
          source_tag: string | null
          stage: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          last_step?: number
          match_snapshot?: Json | null
          matched_count?: number | null
          raise?: string | null
          revenue?: string | null
          source_tag?: string | null
          stage?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          last_step?: number
          match_snapshot?: Json | null
          matched_count?: number | null
          raise?: string | null
          revenue?: string | null
          source_tag?: string | null
          stage?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fit_settings: {
        Row: {
          booking_form: Json | null
          id: string
          updated_at: string
        }
        Insert: {
          booking_form?: Json | null
          id?: string
          updated_at?: string
        }
        Update: {
          booking_form?: Json | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      formd_deal_events: {
        Row: {
          amount_sold: number | null
          confidence: number
          created_at: string
          date_of_first_sale: string | null
          federal_exemption: string | null
          firm_id: string
          id: string
          investor_count: number | null
          issuer_accession: string
          issuer_cik: string
          issuer_industry: string | null
          issuer_name: string
          principal_id: string
          securities_type: string | null
          total_offering: number | null
        }
        Insert: {
          amount_sold?: number | null
          confidence: number
          created_at?: string
          date_of_first_sale?: string | null
          federal_exemption?: string | null
          firm_id: string
          id?: string
          investor_count?: number | null
          issuer_accession: string
          issuer_cik: string
          issuer_industry?: string | null
          issuer_name: string
          principal_id: string
          securities_type?: string | null
          total_offering?: number | null
        }
        Update: {
          amount_sold?: number | null
          confidence?: number
          created_at?: string
          date_of_first_sale?: string | null
          federal_exemption?: string | null
          firm_id?: string
          id?: string
          investor_count?: number | null
          issuer_accession?: string
          issuer_cik?: string
          issuer_industry?: string | null
          issuer_name?: string
          principal_id?: string
          securities_type?: string | null
          total_offering?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "formd_deal_events_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "formd_firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formd_deal_events_principal_id_fkey"
            columns: ["principal_id"]
            isOneToOne: false
            referencedRelation: "formd_principals"
            referencedColumns: ["id"]
          },
        ]
      }
      formd_filings: {
        Row: {
          accession_no: string
          cik: string
          city: string | null
          company_name: string
          created_at: string | null
          date_filed: string | null
          date_first_sale: string | null
          days_since_first_sale: number | null
          derived_funding_stage: string | null
          derived_investor_type: string | null
          entity_type: string | null
          exemptions: string | null
          filing_url: string | null
          form_type: string
          formd_score: number | null
          has_placement_agent: boolean | null
          held_for_review: boolean | null
          industry: string | null
          investor_count: number | null
          is_506c: boolean | null
          is_amendment: boolean | null
          is_fund: boolean | null
          jurisdiction: string | null
          lead_type: Database["public"]["Enums"]["formd_lead_type"]
          min_investment: number | null
          pct_sold: number | null
          phone: string | null
          placement_agents: string | null
          promoted_at: string | null
          promoted_contact_id: string | null
          revenue_range: string | null
          sale_yet_to_occur: boolean | null
          sales_commission: number | null
          score_notes: string | null
          signer_name: string | null
          signer_title: string | null
          state: string | null
          street1: string | null
          street2: string | null
          total_offering: number | null
          total_remaining: number | null
          total_sold: number | null
          updated_at: string | null
          year_of_inc: string | null
          zip_code: string | null
        }
        Insert: {
          accession_no: string
          cik: string
          city?: string | null
          company_name: string
          created_at?: string | null
          date_filed?: string | null
          date_first_sale?: string | null
          days_since_first_sale?: number | null
          derived_funding_stage?: string | null
          derived_investor_type?: string | null
          entity_type?: string | null
          exemptions?: string | null
          filing_url?: string | null
          form_type: string
          formd_score?: number | null
          has_placement_agent?: boolean | null
          held_for_review?: boolean | null
          industry?: string | null
          investor_count?: number | null
          is_506c?: boolean | null
          is_amendment?: boolean | null
          is_fund?: boolean | null
          jurisdiction?: string | null
          lead_type?: Database["public"]["Enums"]["formd_lead_type"]
          min_investment?: number | null
          pct_sold?: number | null
          phone?: string | null
          placement_agents?: string | null
          promoted_at?: string | null
          promoted_contact_id?: string | null
          revenue_range?: string | null
          sale_yet_to_occur?: boolean | null
          sales_commission?: number | null
          score_notes?: string | null
          signer_name?: string | null
          signer_title?: string | null
          state?: string | null
          street1?: string | null
          street2?: string | null
          total_offering?: number | null
          total_remaining?: number | null
          total_sold?: number | null
          updated_at?: string | null
          year_of_inc?: string | null
          zip_code?: string | null
        }
        Update: {
          accession_no?: string
          cik?: string
          city?: string | null
          company_name?: string
          created_at?: string | null
          date_filed?: string | null
          date_first_sale?: string | null
          days_since_first_sale?: number | null
          derived_funding_stage?: string | null
          derived_investor_type?: string | null
          entity_type?: string | null
          exemptions?: string | null
          filing_url?: string | null
          form_type?: string
          formd_score?: number | null
          has_placement_agent?: boolean | null
          held_for_review?: boolean | null
          industry?: string | null
          investor_count?: number | null
          is_506c?: boolean | null
          is_amendment?: boolean | null
          is_fund?: boolean | null
          jurisdiction?: string | null
          lead_type?: Database["public"]["Enums"]["formd_lead_type"]
          min_investment?: number | null
          pct_sold?: number | null
          phone?: string | null
          placement_agents?: string | null
          promoted_at?: string | null
          promoted_contact_id?: string | null
          revenue_range?: string | null
          sale_yet_to_occur?: boolean | null
          sales_commission?: number | null
          score_notes?: string | null
          signer_name?: string | null
          signer_title?: string | null
          state?: string | null
          street1?: string | null
          street2?: string | null
          total_offering?: number | null
          total_remaining?: number | null
          total_sold?: number | null
          updated_at?: string | null
          year_of_inc?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formd_filings_promoted_contact_id_fkey"
            columns: ["promoted_contact_id"]
            isOneToOne: false
            referencedRelation: "contact_sides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formd_filings_promoted_contact_id_fkey"
            columns: ["promoted_contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formd_filings_promoted_contact_id_fkey"
            columns: ["promoted_contact_id"]
            isOneToOne: false
            referencedRelation: "hot_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formd_filings_promoted_contact_id_fkey"
            columns: ["promoted_contact_id"]
            isOneToOne: false
            referencedRelation: "lead_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formd_filings_promoted_contact_id_fkey"
            columns: ["promoted_contact_id"]
            isOneToOne: false
            referencedRelation: "match_campaign_founder_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      formd_firm_vehicles: {
        Row: {
          accession_number: string
          cik: string
          firm_id: string
        }
        Insert: {
          accession_number: string
          cik: string
          firm_id: string
        }
        Update: {
          accession_number?: string
          cik?: string
          firm_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "formd_firm_vehicles_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "formd_firms"
            referencedColumns: ["id"]
          },
        ]
      }
      formd_firms: {
        Row: {
          activity_band: string
          city: string | null
          created_at: string
          display_name: string
          domain: string | null
          est_check_size: number | null
          firm_stem: string
          first_seen_at: string
          formd_rank: number | null
          fund_types: string[] | null
          id: string
          investments_24mo: number
          last_filing_at: string
          last_investment_at: string | null
          last_investment_confidence: number | null
          last_investment_issuer: string | null
          last_investment_round_size: number | null
          needs_review: boolean
          phone: string | null
          promoted_at: string | null
          promoted_investor_id: string | null
          regd_footprint: number | null
          sectors_observed: string[] | null
          state_or_country: string | null
          updated_at: string
          vehicle_count: number
        }
        Insert: {
          activity_band?: string
          city?: string | null
          created_at?: string
          display_name: string
          domain?: string | null
          est_check_size?: number | null
          firm_stem: string
          first_seen_at: string
          formd_rank?: number | null
          fund_types?: string[] | null
          id?: string
          investments_24mo?: number
          last_filing_at: string
          last_investment_at?: string | null
          last_investment_confidence?: number | null
          last_investment_issuer?: string | null
          last_investment_round_size?: number | null
          needs_review?: boolean
          phone?: string | null
          promoted_at?: string | null
          promoted_investor_id?: string | null
          regd_footprint?: number | null
          sectors_observed?: string[] | null
          state_or_country?: string | null
          updated_at?: string
          vehicle_count?: number
        }
        Update: {
          activity_band?: string
          city?: string | null
          created_at?: string
          display_name?: string
          domain?: string | null
          est_check_size?: number | null
          firm_stem?: string
          first_seen_at?: string
          formd_rank?: number | null
          fund_types?: string[] | null
          id?: string
          investments_24mo?: number
          last_filing_at?: string
          last_investment_at?: string | null
          last_investment_confidence?: number | null
          last_investment_issuer?: string | null
          last_investment_round_size?: number | null
          needs_review?: boolean
          phone?: string | null
          promoted_at?: string | null
          promoted_investor_id?: string | null
          regd_footprint?: number | null
          sectors_observed?: string[] | null
          state_or_country?: string | null
          updated_at?: string
          vehicle_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "formd_firms_promoted_investor_id_fkey"
            columns: ["promoted_investor_id"]
            isOneToOne: false
            referencedRelation: "prospect_investors"
            referencedColumns: ["id"]
          },
        ]
      }
      formd_principals: {
        Row: {
          created_at: string
          firm_id: string
          first_name: string
          first_seen_at: string
          id: string
          identity_hash: string
          last_name: string
          last_seen_at: string
          relationship: string[]
        }
        Insert: {
          created_at?: string
          firm_id: string
          first_name: string
          first_seen_at: string
          id?: string
          identity_hash: string
          last_name: string
          last_seen_at: string
          relationship: string[]
        }
        Update: {
          created_at?: string
          firm_id?: string
          first_name?: string
          first_seen_at?: string
          id?: string
          identity_hash?: string
          last_name?: string
          last_seen_at?: string
          relationship?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "formd_principals_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "formd_firms"
            referencedColumns: ["id"]
          },
        ]
      }
      formd_related_persons: {
        Row: {
          accession_no: string
          city: string | null
          created_at: string | null
          first_name: string | null
          full_name: string
          id: string
          is_signer: boolean | null
          last_name: string | null
          middle_name: string | null
          relationships: string | null
          state: string | null
        }
        Insert: {
          accession_no: string
          city?: string | null
          created_at?: string | null
          first_name?: string | null
          full_name: string
          id?: string
          is_signer?: boolean | null
          last_name?: string | null
          middle_name?: string | null
          relationships?: string | null
          state?: string | null
        }
        Update: {
          accession_no?: string
          city?: string | null
          created_at?: string | null
          first_name?: string | null
          full_name?: string
          id?: string
          is_signer?: boolean | null
          last_name?: string | null
          middle_name?: string | null
          relationships?: string | null
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formd_related_persons_accession_no_fkey"
            columns: ["accession_no"]
            isOneToOne: false
            referencedRelation: "formd_filings"
            referencedColumns: ["accession_no"]
          },
        ]
      }
      formd_screening: {
        Row: {
          check_type: string
          checked_at: string
          detail: Json | null
          id: string
          result: string
          subject_id: string
          subject_type: string
        }
        Insert: {
          check_type: string
          checked_at?: string
          detail?: Json | null
          id?: string
          result: string
          subject_id: string
          subject_type: string
        }
        Update: {
          check_type?: string
          checked_at?: string
          detail?: Json | null
          id?: string
          result?: string
          subject_id?: string
          subject_type?: string
        }
        Relationships: []
      }
      founder_contact_lists: {
        Row: {
          company_id: string
          contact_ids: Json
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          contact_ids?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          contact_ids?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_contact_lists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_contact_notes: {
        Row: {
          body: string
          contact_id: string
          created_at: string
          founder_id: string
          id: string
          pinned: boolean
        }
        Insert: {
          body: string
          contact_id: string
          created_at?: string
          founder_id: string
          id?: string
          pinned?: boolean
        }
        Update: {
          body?: string
          contact_id?: string
          created_at?: string
          founder_id?: string
          id?: string
          pinned?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "founder_contact_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "founder_investor_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_contact_notes_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_deploy_preferences: {
        Row: {
          company_id: string
          do_not_contact: string[]
          prefs: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          do_not_contact?: string[]
          prefs?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          do_not_contact?: string[]
          prefs?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_deploy_preferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_digest_items: {
        Row: {
          created_at: string
          excerpt: string | null
          id: number
          reason: string | null
          resolved_at: string | null
          source_job: string
          status: string
          subject: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          excerpt?: string | null
          id?: number
          reason?: string | null
          resolved_at?: string | null
          source_job: string
          status?: string
          subject: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          excerpt?: string | null
          id?: number
          reason?: string | null
          resolved_at?: string | null
          source_job?: string
          status?: string
          subject?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_digest_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_email_prefs: {
        Row: {
          downshift_from: string | null
          downshifted_at: string | null
          mode: string
          send_hour: number | null
          skip_if_active: boolean
          timezone: string | null
          unsubscribed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          downshift_from?: string | null
          downshifted_at?: string | null
          mode?: string
          send_hour?: number | null
          skip_if_active?: boolean
          timezone?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          downshift_from?: string | null
          downshifted_at?: string | null
          mode?: string
          send_hour?: number | null
          skip_if_active?: boolean
          timezone?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_email_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_investor_contacts: {
        Row: {
          check_size_max: number | null
          check_size_min: number | null
          company_id: string
          created_at: string
          crunchbase_url: string | null
          directory_id: string | null
          email: string | null
          firm_name: string | null
          founder_id: string
          geography: string | null
          id: string
          investor_name: string
          investor_profile: Json
          investor_type: string | null
          linkedin_url: string | null
          notes: string | null
          org_id: string | null
          other_social_url: string | null
          personal_website_url: string | null
          phone: string | null
          preferred_sectors: string | null
          preferred_stages: string | null
          source: string
          status: string
          tags: string[]
          twitter_url: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          check_size_max?: number | null
          check_size_min?: number | null
          company_id: string
          created_at?: string
          crunchbase_url?: string | null
          directory_id?: string | null
          email?: string | null
          firm_name?: string | null
          founder_id: string
          geography?: string | null
          id?: string
          investor_name: string
          investor_profile?: Json
          investor_type?: string | null
          linkedin_url?: string | null
          notes?: string | null
          org_id?: string | null
          other_social_url?: string | null
          personal_website_url?: string | null
          phone?: string | null
          preferred_sectors?: string | null
          preferred_stages?: string | null
          source?: string
          status?: string
          tags?: string[]
          twitter_url?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          check_size_max?: number | null
          check_size_min?: number | null
          company_id?: string
          created_at?: string
          crunchbase_url?: string | null
          directory_id?: string | null
          email?: string | null
          firm_name?: string | null
          founder_id?: string
          geography?: string | null
          id?: string
          investor_name?: string
          investor_profile?: Json
          investor_type?: string | null
          linkedin_url?: string | null
          notes?: string | null
          org_id?: string | null
          other_social_url?: string | null
          personal_website_url?: string | null
          phone?: string | null
          preferred_sectors?: string | null
          preferred_stages?: string | null
          source?: string
          status?: string
          tags?: string[]
          twitter_url?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "founder_investor_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_investor_contacts_directory_id_fkey"
            columns: ["directory_id"]
            isOneToOne: false
            referencedRelation: "investor_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_investor_contacts_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_investor_contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_lesson_notes: {
        Row: {
          company_id: string
          content: string
          founder_id: string
          id: string
          lesson_id: string
          module_slug: string
          updated_at: string
        }
        Insert: {
          company_id: string
          content?: string
          founder_id: string
          id?: string
          lesson_id: string
          module_slug: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          content?: string
          founder_id?: string
          id?: string
          lesson_id?: string
          module_slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_lesson_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_lesson_notes_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_lesson_progress: {
        Row: {
          company_id: string
          completed_at: string | null
          founder_id: string
          id: string
          last_viewed_at: string | null
          lesson_id: string
          module_slug: string
          quiz_passed: boolean | null
          quiz_score: number | null
          status: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          founder_id: string
          id?: string
          last_viewed_at?: string | null
          lesson_id: string
          module_slug: string
          quiz_passed?: boolean | null
          quiz_score?: number | null
          status?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          founder_id?: string
          id?: string
          last_viewed_at?: string | null
          lesson_id?: string
          module_slug?: string
          quiz_passed?: boolean | null
          quiz_score?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_lesson_progress_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_lesson_progress_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_lesson_video_assets: {
        Row: {
          captions: string | null
          company_id: string
          course_slug: string
          created_at: string
          founder_id: string
          id: string
          lesson_slug: string
          narration_text: string | null
          provider: string
          render_status: string
          script: string | null
          slide_deck_storage_path: string | null
          slide_deck_url: string | null
          slides_json: Json
          updated_at: string
          video_url: string | null
          watch_position_seconds: number | null
        }
        Insert: {
          captions?: string | null
          company_id: string
          course_slug: string
          created_at?: string
          founder_id: string
          id?: string
          lesson_slug: string
          narration_text?: string | null
          provider?: string
          render_status?: string
          script?: string | null
          slide_deck_storage_path?: string | null
          slide_deck_url?: string | null
          slides_json?: Json
          updated_at?: string
          video_url?: string | null
          watch_position_seconds?: number | null
        }
        Update: {
          captions?: string | null
          company_id?: string
          course_slug?: string
          created_at?: string
          founder_id?: string
          id?: string
          lesson_slug?: string
          narration_text?: string | null
          provider?: string
          render_status?: string
          script?: string | null
          slide_deck_storage_path?: string | null
          slide_deck_url?: string | null
          slides_json?: Json
          updated_at?: string
          video_url?: string | null
          watch_position_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "founder_lesson_video_assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_lesson_video_assets_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_manual_investors: {
        Row: {
          check_size: string | null
          company_id: string
          created_at: string
          email: string | null
          firm: string | null
          founder_id: string
          id: string
          invited: boolean
          invited_at: string | null
          name: string
          notes: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          check_size?: string | null
          company_id: string
          created_at?: string
          email?: string | null
          firm?: string | null
          founder_id: string
          id?: string
          invited?: boolean
          invited_at?: string | null
          name: string
          notes?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          check_size?: string | null
          company_id?: string
          created_at?: string
          email?: string | null
          firm?: string | null
          founder_id?: string
          id?: string
          invited?: boolean
          invited_at?: string | null
          name?: string
          notes?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_manual_investors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_manual_investors_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_manual_outreach: {
        Row: {
          attachments: Json
          company_id: string
          created_at: string
          created_by: string | null
          email_body: string | null
          email_subject: string | null
          id: string
          recipient_ids: Json
          sequence: Json
          status: string
          stop_on_reply: boolean
          updated_at: string
        }
        Insert: {
          attachments?: Json
          company_id: string
          created_at?: string
          created_by?: string | null
          email_body?: string | null
          email_subject?: string | null
          id?: string
          recipient_ids?: Json
          sequence?: Json
          status?: string
          stop_on_reply?: boolean
          updated_at?: string
        }
        Update: {
          attachments?: Json
          company_id?: string
          created_at?: string
          created_by?: string | null
          email_body?: string | null
          email_subject?: string | null
          id?: string
          recipient_ids?: Json
          sequence?: Json
          status?: string
          stop_on_reply?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_manual_outreach_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_manual_outreach_recipients: {
        Row: {
          clicked_at: string | null
          company_id: string
          contact_id: string
          email: string
          enrolled_at: string
          id: string
          last_sent_at: string | null
          max_steps: number | null
          name: string | null
          next_step_index: number
          opened_at: string | null
          replied_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          clicked_at?: string | null
          company_id: string
          contact_id: string
          email: string
          enrolled_at?: string
          id?: string
          last_sent_at?: string | null
          max_steps?: number | null
          name?: string | null
          next_step_index?: number
          opened_at?: string | null
          replied_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          clicked_at?: string | null
          company_id?: string
          contact_id?: string
          email?: string
          enrolled_at?: string
          id?: string
          last_sent_at?: string | null
          max_steps?: number | null
          name?: string | null
          next_step_index?: number
          opened_at?: string | null
          replied_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_manual_outreach_recipients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_manual_outreach_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "founder_investor_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_match_digest_state: {
        Row: {
          company_id: string
          last_sent_at: string | null
          seen_refs: string[]
          updated_at: string
        }
        Insert: {
          company_id: string
          last_sent_at?: string | null
          seen_refs?: string[]
          updated_at?: string
        }
        Update: {
          company_id?: string
          last_sent_at?: string | null
          seen_refs?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_match_digest_state_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_outreach_overrides: {
        Row: {
          company_id: string
          overrides: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          overrides?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          overrides?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "founder_outreach_overrides_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_outreach_overrides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_outreach_targets: {
        Row: {
          company_id: string
          contact_id: string | null
          created_at: string
          founder_id: string
          id: string
          last_contacted_at: string | null
          match_score: number | null
          next_follow_up_at: string | null
          notes: string | null
          platform_investor_id: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          contact_id?: string | null
          created_at?: string
          founder_id: string
          id?: string
          last_contacted_at?: string | null
          match_score?: number | null
          next_follow_up_at?: string | null
          notes?: string | null
          platform_investor_id?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          contact_id?: string | null
          created_at?: string
          founder_id?: string
          id?: string
          last_contacted_at?: string | null
          match_score?: number | null
          next_follow_up_at?: string | null
          notes?: string | null
          platform_investor_id?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_outreach_targets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_outreach_targets_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "founder_investor_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_outreach_targets_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_outreach_targets_platform_investor_id_fkey"
            columns: ["platform_investor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_quiz_attempts: {
        Row: {
          answers: Json
          company_id: string
          created_at: string
          founder_id: string
          id: string
          lesson_id: string
          module_slug: string
          passed: boolean
          score: number
        }
        Insert: {
          answers?: Json
          company_id: string
          created_at?: string
          founder_id: string
          id?: string
          lesson_id: string
          module_slug: string
          passed?: boolean
          score: number
        }
        Update: {
          answers?: Json
          company_id?: string
          created_at?: string
          founder_id?: string
          id?: string
          lesson_id?: string
          module_slug?: string
          passed?: boolean
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "founder_quiz_attempts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_quiz_attempts_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_quiz_reviews: {
        Row: {
          company_id: string
          ease_factor: number
          founder_id: string
          id: string
          interval_days: number
          last_score: number | null
          lesson_id: string
          module_slug: string
          next_review_at: string
          question_id: string
          review_count: number
        }
        Insert: {
          company_id: string
          ease_factor?: number
          founder_id: string
          id?: string
          interval_days?: number
          last_score?: number | null
          lesson_id: string
          module_slug: string
          next_review_at?: string
          question_id: string
          review_count?: number
        }
        Update: {
          company_id?: string
          ease_factor?: number
          founder_id?: string
          id?: string
          interval_days?: number
          last_score?: number | null
          lesson_id?: string
          module_slug?: string
          next_review_at?: string
          question_id?: string
          review_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "founder_quiz_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_quiz_reviews_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_remediation_tasks: {
        Row: {
          category: string
          company_id: string
          completed_at: string | null
          created_at: string
          description: string
          founder_id: string
          id: string
          priority: string
          recommended_action: string
          related_feature: string | null
          source_key: string
          source_type: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          company_id: string
          completed_at?: string | null
          created_at?: string
          description: string
          founder_id: string
          id?: string
          priority: string
          recommended_action: string
          related_feature?: string | null
          source_key: string
          source_type: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string
          founder_id?: string
          id?: string
          priority?: string
          recommended_action?: string
          related_feature?: string | null
          source_key?: string
          source_type?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_remediation_tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_remediation_tasks_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_social_limits: {
        Row: {
          enabled: boolean
          plan_type: string
          posts_per_month: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          plan_type: string
          posts_per_month?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          plan_type?: string
          posts_per_month?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "founder_social_limits_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_stage_step_progress: {
        Row: {
          company_id: string
          completed_at: string | null
          first_visited_at: string | null
          step_href: string
          updated_at: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          first_visited_at?: string | null
          step_href: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          first_visited_at?: string | null
          step_href?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_stage_step_progress_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_testimonials: {
        Row: {
          anonymous: boolean
          company_id: string | null
          company_name: string | null
          consent_at: string
          created_at: string
          crr_current: number | null
          crr_start: number | null
          email: string
          id: string
          industry: string | null
          name: string
          profile_id: string | null
          quote: string
          reviewed_at: string | null
          reviewed_by: string | null
          show_score: boolean
          stage: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          anonymous?: boolean
          company_id?: string | null
          company_name?: string | null
          consent_at: string
          created_at?: string
          crr_current?: number | null
          crr_start?: number | null
          email: string
          id?: string
          industry?: string | null
          name: string
          profile_id?: string | null
          quote: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          show_score?: boolean
          stage?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          anonymous?: boolean
          company_id?: string | null
          company_name?: string | null
          consent_at?: string
          created_at?: string
          crr_current?: number | null
          crr_start?: number | null
          email?: string
          id?: string
          industry?: string | null
          name?: string
          profile_id?: string | null
          quote?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          show_score?: boolean
          stage?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_testimonials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_testimonials_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_testimonials_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_worksheet_submissions: {
        Row: {
          admin_feedback: string | null
          company_id: string
          content: string
          feedback_given_at: string | null
          feedback_given_by: string | null
          founder_id: string
          id: string
          lesson_id: string
          module_slug: string
          submitted_at: string
        }
        Insert: {
          admin_feedback?: string | null
          company_id: string
          content: string
          feedback_given_at?: string | null
          feedback_given_by?: string | null
          founder_id: string
          id?: string
          lesson_id: string
          module_slug: string
          submitted_at?: string
        }
        Update: {
          admin_feedback?: string | null
          company_id?: string
          content?: string
          feedback_given_at?: string | null
          feedback_given_by?: string | null
          founder_id?: string
          id?: string
          lesson_id?: string
          module_slug?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_worksheet_submissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_worksheet_submissions_feedback_given_by_fkey"
            columns: ["feedback_given_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "founder_worksheet_submissions_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_events: {
        Row: {
          event_name: string
          id: number
          occurred_at: string
          organization_id: string | null
          properties: Json | null
          session_id: string
        }
        Insert: {
          event_name: string
          id?: number
          occurred_at?: string
          organization_id?: string | null
          properties?: Json | null
          session_id: string
        }
        Update: {
          event_name?: string
          id?: number
          occurred_at?: string
          organization_id?: string | null
          properties?: Json | null
          session_id?: string
        }
        Relationships: []
      }
      gmail_read_marks: {
        Row: {
          gmail_thread_id: string
          owner_id: string
          read_at: string
        }
        Insert: {
          gmail_thread_id: string
          owner_id: string
          read_at?: string
        }
        Update: {
          gmail_thread_id?: string
          owner_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_read_marks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batch_rows: {
        Row: {
          batch_id: string
          created_at: string
          created_entity_id: string | null
          created_entity_type: string | null
          errors: Json | null
          id: string
          mapped_data: Json | null
          raw_data: Json
          row_number: number
          status: string
          warnings: Json | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          created_entity_id?: string | null
          created_entity_type?: string | null
          errors?: Json | null
          id?: string
          mapped_data?: Json | null
          raw_data?: Json
          row_number: number
          status: string
          warnings?: Json | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          created_entity_id?: string | null
          created_entity_type?: string | null
          errors?: Json | null
          id?: string
          mapped_data?: Json | null
          raw_data?: Json
          row_number?: number
          status?: string
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "import_batch_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          completed_at: string | null
          created_at: string
          created_rows: number
          error_rows: number
          failed_rows: number
          file_name: string
          id: string
          import_type: string
          mapping: Json | null
          skipped_rows: number
          status: string
          summary: Json | null
          total_rows: number
          updated_rows: number
          uploaded_by: string
          valid_rows: number
          warning_rows: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_rows?: number
          error_rows?: number
          failed_rows?: number
          file_name: string
          id?: string
          import_type: string
          mapping?: Json | null
          skipped_rows?: number
          status?: string
          summary?: Json | null
          total_rows?: number
          updated_rows?: number
          uploaded_by: string
          valid_rows?: number
          warning_rows?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_rows?: number
          error_rows?: number
          failed_rows?: number
          file_name?: string
          id?: string
          import_type?: string
          mapping?: Json | null
          skipped_rows?: number
          status?: string
          summary?: Json | null
          total_rows?: number
          updated_rows?: number
          uploaded_by?: string
          valid_rows?: number
          warning_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          display_name: string
          enabled: boolean
          id: string
          last_delivery_at: string | null
          last_failure_at: string | null
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          display_name?: string
          enabled?: boolean
          id?: string
          last_delivery_at?: string | null
          last_failure_at?: string | null
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          display_name?: string
          enabled?: boolean
          id?: string
          last_delivery_at?: string | null
          last_failure_at?: string | null
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_delivery_logs: {
        Row: {
          attempt_count: number
          connection_id: string
          created_at: string
          delivered_at: string | null
          error_message: string | null
          event_type: string
          id: string
          max_attempts: number
          next_retry_at: string | null
          payload_metadata: Json
          response_code: number | null
          status: string
        }
        Insert: {
          attempt_count?: number
          connection_id: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          max_attempts?: number
          next_retry_at?: string | null
          payload_metadata?: Json
          response_code?: number | null
          status?: string
        }
        Update: {
          attempt_count?: number
          connection_id?: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          max_attempts?: number
          next_retry_at?: string | null
          payload_metadata?: Json
          response_code?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_delivery_logs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_permissions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          label: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          label: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          slug?: string
        }
        Relationships: []
      }
      internal_role_permissions: {
        Row: {
          granted: boolean
          permission_id: string
          role_id: string
        }
        Insert: {
          granted?: boolean
          permission_id: string
          role_id: string
        }
        Update: {
          granted?: boolean
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "internal_permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "internal_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          label: string
          rank: number
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          rank?: number
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          rank?: number
          slug?: string
        }
        Relationships: []
      }
      internal_user_permission_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          granted: boolean
          permission_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          granted: boolean
          permission_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          granted?: boolean
          permission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_user_permission_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_user_permission_overrides_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "internal_permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_user_permission_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          is_active: boolean
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          is_active?: boolean
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          is_active?: boolean
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "internal_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      intro_requests: {
        Row: {
          campaign_id: string | null
          company_id: string
          created_at: string
          direction: string
          expires_at: string | null
          facilitated_at: string | null
          facilitator_note: string | null
          id: string
          investor_id: string | null
          message: string | null
          org_id: string | null
          pipeline_investor_id: string | null
          requested_by: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          campaign_id?: string | null
          company_id: string
          created_at?: string
          direction?: string
          expires_at?: string | null
          facilitated_at?: string | null
          facilitator_note?: string | null
          id?: string
          investor_id?: string | null
          message?: string | null
          org_id?: string | null
          pipeline_investor_id?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          campaign_id?: string | null
          company_id?: string
          created_at?: string
          direction?: string
          expires_at?: string | null
          facilitated_at?: string | null
          facilitator_note?: string | null
          id?: string
          investor_id?: string | null
          message?: string | null
          org_id?: string | null
          pipeline_investor_id?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intro_requests_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intro_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intro_requests_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intro_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intro_requests_pipeline_investor_id_fkey"
            columns: ["pipeline_investor_id"]
            isOneToOne: false
            referencedRelation: "pipeline_investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intro_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_activity: {
        Row: {
          activity_type: string
          campaign_id: string | null
          company_id: string
          created_at: string
          id: string
          investor_id: string
          metadata: Json
        }
        Insert: {
          activity_type: string
          campaign_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          investor_id: string
          metadata?: Json
        }
        Update: {
          activity_type?: string
          campaign_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          investor_id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "investor_activity_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_activity_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_activity_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_directory: {
        Row: {
          avg_investment: number | null
          capital_types: string[]
          city: string | null
          contact_name: string | null
          country: string
          created_at: string
          email: string | null
          firm: string
          fund_name: string | null
          fund_size: number | null
          funding_stages: string[]
          id: string
          import_id: string | null
          in_network: boolean
          industries: string[]
          investing_now: boolean | null
          investor_types: string[]
          notes: string | null
          opted_out_at: string | null
          phone: string | null
          source: string
          source_url: string | null
          state: string | null
          status: string
          strategy: string | null
          title: string | null
          updated_at: string
          verification: string
          verified_at: string | null
          verified_by: string | null
          website: string | null
        }
        Insert: {
          avg_investment?: number | null
          capital_types?: string[]
          city?: string | null
          contact_name?: string | null
          country?: string
          created_at?: string
          email?: string | null
          firm: string
          fund_name?: string | null
          fund_size?: number | null
          funding_stages?: string[]
          id?: string
          import_id?: string | null
          in_network?: boolean
          industries?: string[]
          investing_now?: boolean | null
          investor_types?: string[]
          notes?: string | null
          opted_out_at?: string | null
          phone?: string | null
          source: string
          source_url?: string | null
          state?: string | null
          status?: string
          strategy?: string | null
          title?: string | null
          updated_at?: string
          verification?: string
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
        }
        Update: {
          avg_investment?: number | null
          capital_types?: string[]
          city?: string | null
          contact_name?: string | null
          country?: string
          created_at?: string
          email?: string | null
          firm?: string
          fund_name?: string | null
          fund_size?: number | null
          funding_stages?: string[]
          id?: string
          import_id?: string | null
          in_network?: boolean
          industries?: string[]
          investing_now?: boolean | null
          investor_types?: string[]
          notes?: string | null
          opted_out_at?: string | null
          phone?: string | null
          source?: string
          source_url?: string | null
          state?: string | null
          status?: string
          strategy?: string | null
          title?: string | null
          updated_at?: string
          verification?: string
          verified_at?: string | null
          verified_by?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_directory_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "investor_directory_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_directory_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_directory_access: {
        Row: {
          founder_id: string
          status: string
          status_reason: string | null
          terms_accepted_at: string | null
          terms_version: number | null
          tier: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          founder_id: string
          status?: string
          status_reason?: string | null
          terms_accepted_at?: string | null
          terms_version?: number | null
          tier?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          founder_id?: string
          status?: string
          status_reason?: string | null
          terms_accepted_at?: string | null
          terms_version?: number | null
          tier?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_directory_access_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_directory_access_tier_fkey"
            columns: ["tier"]
            isOneToOne: false
            referencedRelation: "investor_directory_tiers"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "investor_directory_access_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_directory_events: {
        Row: {
          company_id: string | null
          count: number
          created_at: string
          detail: string | null
          founder_id: string
          id: string
          kind: string
        }
        Insert: {
          company_id?: string | null
          count?: number
          created_at?: string
          detail?: string | null
          founder_id: string
          id?: string
          kind: string
        }
        Update: {
          company_id?: string | null
          count?: number
          created_at?: string
          detail?: string | null
          founder_id?: string
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_directory_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_directory_events_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_directory_import_memory: {
        Row: {
          fields: string[]
          header_key: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          fields?: string[]
          header_key: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          fields?: string[]
          header_key?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      investor_directory_imports: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          created_count: number
          file_name: string | null
          id: string
          invalid_email_count: number
          merged_count: number
          name: string
          published_at: string | null
          row_count: number
          source: string
          source_url: string | null
          status: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          created_count?: number
          file_name?: string | null
          id?: string
          invalid_email_count?: number
          merged_count?: number
          name: string
          published_at?: string | null
          row_count?: number
          source: string
          source_url?: string | null
          status?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          created_count?: number
          file_name?: string | null
          id?: string
          invalid_email_count?: number
          merged_count?: number
          name?: string
          published_at?: string | null
          row_count?: number
          source?: string
          source_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_directory_imports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_directory_plan_allowances: {
        Row: {
          contacts: number
          emails_per_month: number
          label: string
          plan_type: string
          sort: number
          updated_at: string
        }
        Insert: {
          contacts?: number
          emails_per_month?: number
          label: string
          plan_type: string
          sort?: number
          updated_at?: string
        }
        Update: {
          contacts?: number
          emails_per_month?: number
          label?: string
          plan_type?: string
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      investor_directory_settings: {
        Row: {
          allow_export: boolean
          auto_pause_on_bounce: boolean
          block_over_limit: boolean
          bounce_min_sends: number
          bounce_pause_pct: number
          daily_cap: number
          honor_opt_outs: boolean
          id: number
          require_terms: boolean
          spike_hours: number
          spike_imports: number
          stale_days: number
          tab_csv: boolean
          tab_directory: boolean
          tab_formd: boolean
          tab_linkedin: boolean
          terms_version: number
          updated_at: string
        }
        Insert: {
          allow_export?: boolean
          auto_pause_on_bounce?: boolean
          block_over_limit?: boolean
          bounce_min_sends?: number
          bounce_pause_pct?: number
          daily_cap?: number
          honor_opt_outs?: boolean
          id?: number
          require_terms?: boolean
          spike_hours?: number
          spike_imports?: number
          stale_days?: number
          tab_csv?: boolean
          tab_directory?: boolean
          tab_formd?: boolean
          tab_linkedin?: boolean
          terms_version?: number
          updated_at?: string
        }
        Update: {
          allow_export?: boolean
          auto_pause_on_bounce?: boolean
          block_over_limit?: boolean
          bounce_min_sends?: number
          bounce_pause_pct?: number
          daily_cap?: number
          honor_opt_outs?: boolean
          id?: number
          require_terms?: boolean
          spike_hours?: number
          spike_imports?: number
          stale_days?: number
          tab_csv?: boolean
          tab_directory?: boolean
          tab_formd?: boolean
          tab_linkedin?: boolean
          terms_version?: number
          updated_at?: string
        }
        Relationships: []
      }
      investor_directory_tiers: {
        Row: {
          can_export: boolean
          email_limit: number
          hold_limit: number
          key: string
          label: string
          price_cents: number | null
          show_email: boolean
          sort: number
        }
        Insert: {
          can_export?: boolean
          email_limit?: number
          hold_limit: number
          key: string
          label: string
          price_cents?: number | null
          show_email?: boolean
          sort?: number
        }
        Update: {
          can_export?: boolean
          email_limit?: number
          hold_limit?: number
          key?: string
          label?: string
          price_cents?: number | null
          show_email?: boolean
          sort?: number
        }
        Relationships: []
      }
      investor_enrichment: {
        Row: {
          basis: string | null
          confidence: number
          contact_id: string
          created_at: string
          id: string
          model: string | null
          proposed_industries: string[]
          proposed_stage: string[]
          proposed_type: string | null
          rationale: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          basis?: string | null
          confidence?: number
          contact_id: string
          created_at?: string
          id?: string
          model?: string | null
          proposed_industries?: string[]
          proposed_stage?: string[]
          proposed_type?: string | null
          rationale?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          basis?: string | null
          confidence?: number
          contact_id?: string
          created_at?: string
          id?: string
          model?: string | null
          proposed_industries?: string[]
          proposed_stage?: string[]
          proposed_type?: string | null
          rationale?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_enrichment_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contact_sides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_enrichment_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_enrichment_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "hot_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_enrichment_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "lead_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_enrichment_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "match_campaign_founder_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_founder_matches: {
        Row: {
          company_id: string
          expires_at: string
          fit_score_at_match: number
          founder_responded_at: string | null
          id: string
          introduced_at: string | null
          investor_profile_id: string
          investor_responded_at: string | null
          match_score: number
          prescore_at_match: number
          score_breakdown: Json | null
          status: Database["public"]["Enums"]["match_status"]
          suggested_at: string
        }
        Insert: {
          company_id: string
          expires_at?: string
          fit_score_at_match: number
          founder_responded_at?: string | null
          id?: string
          introduced_at?: string | null
          investor_profile_id: string
          investor_responded_at?: string | null
          match_score: number
          prescore_at_match: number
          score_breakdown?: Json | null
          status?: Database["public"]["Enums"]["match_status"]
          suggested_at?: string
        }
        Update: {
          company_id?: string
          expires_at?: string
          fit_score_at_match?: number
          founder_responded_at?: string | null
          id?: string
          introduced_at?: string | null
          investor_profile_id?: string
          investor_responded_at?: string | null
          match_score?: number
          prescore_at_match?: number
          score_breakdown?: Json | null
          status?: Database["public"]["Enums"]["match_status"]
          suggested_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_founder_matches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_founder_matches_investor_profile_id_fkey"
            columns: ["investor_profile_id"]
            isOneToOne: false
            referencedRelation: "investor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_interests: {
        Row: {
          campaign_id: string | null
          company_id: string | null
          created_at: string | null
          id: string
          interest_amount: number | null
          investor_id: string | null
          message: string | null
          pledge_amount: number | null
          pledge_amount_updated_at: string | null
          pledge_currency: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          interest_amount?: number | null
          investor_id?: string | null
          message?: string | null
          pledge_amount?: number | null
          pledge_amount_updated_at?: string | null
          pledge_currency?: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          interest_amount?: number | null
          investor_id?: string | null
          message?: string | null
          pledge_amount?: number | null
          pledge_amount_updated_at?: string | null
          pledge_currency?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_interests_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_interests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_interests_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_kyc_documents: {
        Row: {
          doc_type: string
          file_name: string
          file_path: string
          id: string
          investor_profile_id: string
          mime_type: string | null
          size_bytes: number | null
          status: string
          uploaded_at: string
        }
        Insert: {
          doc_type: string
          file_name: string
          file_path: string
          id?: string
          investor_profile_id: string
          mime_type?: string | null
          size_bytes?: number | null
          status?: string
          uploaded_at?: string
        }
        Update: {
          doc_type?: string
          file_name?: string
          file_path?: string
          id?: string
          investor_profile_id?: string
          mime_type?: string | null
          size_bytes?: number | null
          status?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_kyc_documents_investor_profile_id_fkey"
            columns: ["investor_profile_id"]
            isOneToOne: false
            referencedRelation: "investor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_match_index: {
        Row: {
          company: string
          company_key: string
          contact_id: string
          industries: string[]
          inv_source: string | null
          inv_verified_at: string | null
          revenues: string[]
          sizes: string[]
          source_synced_at: string | null
          stages: string[]
          types: string[]
          updated_at: string
        }
        Insert: {
          company: string
          company_key: string
          contact_id: string
          industries?: string[]
          inv_source?: string | null
          inv_verified_at?: string | null
          revenues?: string[]
          sizes?: string[]
          source_synced_at?: string | null
          stages?: string[]
          types?: string[]
          updated_at?: string
        }
        Update: {
          company?: string
          company_key?: string
          contact_id?: string
          industries?: string[]
          inv_source?: string | null
          inv_verified_at?: string | null
          revenues?: string[]
          sizes?: string[]
          source_synced_at?: string | null
          stages?: string[]
          types?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_match_index_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contact_sides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_match_index_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_match_index_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "hot_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_match_index_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "lead_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_match_index_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "match_campaign_founder_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_outreach_campaigns: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          last_run_at: string | null
          paused: boolean
          status: string
          template_key: string
          updated_at: string
          weekly_cap: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_run_at?: string | null
          paused?: boolean
          status?: string
          template_key?: string
          updated_at?: string
          weekly_cap?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_run_at?: string | null
          paused?: boolean
          status?: string
          template_key?: string
          updated_at?: string
          weekly_cap?: number
        }
        Relationships: [
          {
            foreignKeyName: "investor_outreach_campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_outreach_recipients: {
        Row: {
          campaign_id: string
          clicked_at: string | null
          created_at: string
          email: string | null
          id: string
          investor_name: string
          investor_ref: string
          match_score: number
          opened_at: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          clicked_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          investor_name: string
          investor_ref: string
          match_score?: number
          opened_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          clicked_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          investor_name?: string
          investor_ref?: string
          match_score?: number
          opened_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_outreach_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "investor_outreach_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_pipeline: {
        Row: {
          campaign_id: string | null
          company_id: string
          created_at: string
          id: string
          investor_id: string
          last_activity_at: string
          last_contacted_at: string | null
          next_follow_up_at: string | null
          notes: string | null
          owner_admin_id: string | null
          probability: number
          stage: string
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          investor_id: string
          last_activity_at?: string
          last_contacted_at?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          owner_admin_id?: string | null
          probability?: number
          stage?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          investor_id?: string
          last_activity_at?: string
          last_contacted_at?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          owner_admin_id?: string | null
          probability?: number
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_pipeline_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_pipeline_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_pipeline_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_pipeline_owner_admin_id_fkey"
            columns: ["owner_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_prior_deals: {
        Row: {
          amount: number | null
          company_name: string
          created_at: string
          id: string
          investor_profile_id: string
          proof_document_id: string | null
          stage: string | null
          verified: boolean
          verified_at: string | null
          verified_by: string | null
          year: number | null
        }
        Insert: {
          amount?: number | null
          company_name: string
          created_at?: string
          id?: string
          investor_profile_id: string
          proof_document_id?: string | null
          stage?: string | null
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
          year?: number | null
        }
        Update: {
          amount?: number | null
          company_name?: string
          created_at?: string
          id?: string
          investor_profile_id?: string
          proof_document_id?: string | null
          stage?: string | null
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_prior_deals_investor_profile_id_fkey"
            columns: ["investor_profile_id"]
            isOneToOne: false
            referencedRelation: "investor_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_prior_deals_proof_document_id_fkey"
            columns: ["proof_document_id"]
            isOneToOne: false
            referencedRelation: "investor_kyc_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_profiles: {
        Row: {
          accreditation_reviewed_at: string | null
          accreditation_reviewed_by: string | null
          accreditation_verified: boolean
          accredited_status: boolean
          address_city: string | null
          address_country: string | null
          address_line1: string | null
          address_postal_code: string | null
          address_state: string | null
          admin_feedback: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          archived_at: string | null
          capital_types: string[]
          check_size_max: number | null
          check_size_min: number | null
          contact_preference: string | null
          created_at: string
          firm_name: string | null
          id: string
          investment_thesis: string | null
          investor_type: string | null
          kyc_consent: boolean
          kyc_feedback: string | null
          kyc_reviewed_at: string | null
          kyc_reviewed_by: string | null
          kyc_status: string
          kyc_submitted_at: string | null
          legal_name: string | null
          preferred_arr_range: string | null
          preferred_geographies: string[]
          preferred_mrr_range: string | null
          preferred_sectors: string[]
          preferred_stages: string[]
          profile_id: string
          show_track_record: boolean
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          accreditation_reviewed_at?: string | null
          accreditation_reviewed_by?: string | null
          accreditation_verified?: boolean
          accredited_status?: boolean
          address_city?: string | null
          address_country?: string | null
          address_line1?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          admin_feedback?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          capital_types?: string[]
          check_size_max?: number | null
          check_size_min?: number | null
          contact_preference?: string | null
          created_at?: string
          firm_name?: string | null
          id?: string
          investment_thesis?: string | null
          investor_type?: string | null
          kyc_consent?: boolean
          kyc_feedback?: string | null
          kyc_reviewed_at?: string | null
          kyc_reviewed_by?: string | null
          kyc_status?: string
          kyc_submitted_at?: string | null
          legal_name?: string | null
          preferred_arr_range?: string | null
          preferred_geographies?: string[]
          preferred_mrr_range?: string | null
          preferred_sectors?: string[]
          preferred_stages?: string[]
          profile_id: string
          show_track_record?: boolean
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          accreditation_reviewed_at?: string | null
          accreditation_reviewed_by?: string | null
          accreditation_verified?: boolean
          accredited_status?: boolean
          address_city?: string | null
          address_country?: string | null
          address_line1?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          admin_feedback?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          capital_types?: string[]
          check_size_max?: number | null
          check_size_min?: number | null
          contact_preference?: string | null
          created_at?: string
          firm_name?: string | null
          id?: string
          investment_thesis?: string | null
          investor_type?: string | null
          kyc_consent?: boolean
          kyc_feedback?: string | null
          kyc_reviewed_at?: string | null
          kyc_reviewed_by?: string | null
          kyc_status?: string
          kyc_submitted_at?: string | null
          legal_name?: string | null
          preferred_arr_range?: string | null
          preferred_geographies?: string[]
          preferred_mrr_range?: string | null
          preferred_sectors?: string[]
          preferred_stages?: string[]
          profile_id?: string
          show_track_record?: boolean
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_activities: {
        Row: {
          assignee_id: string | null
          calendar_event_id: string | null
          created_at: string
          created_by: string
          description: string | null
          done_at: string | null
          due_at: string | null
          founder_visible: boolean
          id: string
          match_id: string | null
          next_step: string | null
          outcome: string | null
          project_id: string
          subject: string
          task_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          calendar_event_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          done_at?: string | null
          due_at?: string | null
          founder_visible?: boolean
          id?: string
          match_id?: string | null
          next_step?: string | null
          outcome?: string | null
          project_id: string
          subject: string
          task_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          calendar_event_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          done_at?: string | null
          due_at?: string | null
          founder_visible?: boolean
          id?: string
          match_id?: string | null
          next_step?: string | null
          outcome?: string | null
          project_id?: string
          subject?: string
          task_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ir_activities_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_activities_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "ir_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ir_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_activities_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "ir_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_agent_access_overrides: {
        Row: {
          enabled: boolean
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled: boolean
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ir_agent_access_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_agent_answers: {
        Row: {
          agent_id: string
          answer: string
          created_at: string
          id: string
          question: string
        }
        Insert: {
          agent_id: string
          answer: string
          created_at?: string
          id?: string
          question: string
        }
        Update: {
          agent_id?: string
          answer?: string
          created_at?: string
          id?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "ir_agent_answers_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ir_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_agent_contact_fields: {
        Row: {
          agent_id: string
          enabled: boolean
          id: string
          key: string
          kind: string
          label: string
          options: Json
          position: number
          required: boolean
        }
        Insert: {
          agent_id: string
          enabled?: boolean
          id?: string
          key: string
          kind: string
          label: string
          options?: Json
          position: number
          required?: boolean
        }
        Update: {
          agent_id?: string
          enabled?: boolean
          id?: string
          key?: string
          kind?: string
          label?: string
          options?: Json
          position?: number
          required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ir_agent_contact_fields_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ir_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_agent_conversations: {
        Row: {
          agent_id: string
          booked_at: string | null
          contact: Json
          created_at: string
          id: string
          profile: Json
          review_state: string
          session_id: string
          source: string | null
          stopped: boolean
          transcript: Json
          updated_at: string
        }
        Insert: {
          agent_id: string
          booked_at?: string | null
          contact?: Json
          created_at?: string
          id?: string
          profile?: Json
          review_state?: string
          session_id: string
          source?: string | null
          stopped?: boolean
          transcript?: Json
          updated_at?: string
        }
        Update: {
          agent_id?: string
          booked_at?: string | null
          contact?: Json
          created_at?: string
          id?: string
          profile?: Json
          review_state?: string
          session_id?: string
          source?: string | null
          stopped?: boolean
          transcript?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ir_agent_conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ir_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_agent_plan_access: {
        Row: {
          plan_key: string
          updated_at: string
        }
        Insert: {
          plan_key: string
          updated_at?: string
        }
        Update: {
          plan_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      ir_agent_questions: {
        Row: {
          agent_id: string
          created_at: string
          edited: boolean
          enabled: boolean
          field: string
          id: string
          is_default: boolean
          options: Json
          position: number
          prompt: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          edited?: boolean
          enabled?: boolean
          field: string
          id?: string
          is_default?: boolean
          options?: Json
          position: number
          prompt: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          edited?: boolean
          enabled?: boolean
          field?: string
          id?: string
          is_default?: boolean
          options?: Json
          position?: number
          prompt?: string
        }
        Relationships: [
          {
            foreignKeyName: "ir_agent_questions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ir_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_agent_reserved_slugs: {
        Row: {
          slug: string
        }
        Insert: {
          slug: string
        }
        Update: {
          slug?: string
        }
        Relationships: []
      }
      ir_agent_sources: {
        Row: {
          agent_id: string
          bytes: number
          created_at: string
          extracted_text: string | null
          file_name: string
          id: string
          status: string
          storage_path: string
        }
        Insert: {
          agent_id: string
          bytes?: number
          created_at?: string
          extracted_text?: string | null
          file_name: string
          id?: string
          status?: string
          storage_path: string
        }
        Update: {
          agent_id?: string
          bytes?: number
          created_at?: string
          extracted_text?: string | null
          file_name?: string
          id?: string
          status?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "ir_agent_sources_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ir_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_agent_template: {
        Row: {
          contact_fields: Json
          display_name: string | null
          id: number
          questions: Json
          updated_at: string
          updated_by: string | null
          version: number
          welcome_message: string | null
        }
        Insert: {
          contact_fields?: Json
          display_name?: string | null
          id?: number
          questions?: Json
          updated_at?: string
          updated_by?: string | null
          version?: number
          welcome_message?: string | null
        }
        Update: {
          contact_fields?: Json
          display_name?: string | null
          id?: number
          questions?: Json
          updated_at?: string
          updated_by?: string | null
          version?: number
          welcome_message?: string | null
        }
        Relationships: []
      }
      ir_agents: {
        Row: {
          about: string | null
          company_name: string
          company_slug: string
          compliance_acknowledged_at: string | null
          compliance_acknowledged_by: string | null
          created_at: string
          created_by: string | null
          display_name: string
          ending: string
          host_profile_id: string | null
          id: string
          image_path: string | null
          image_url: string | null
          organization_id: string
          status: string
          template_version: number
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          about?: string | null
          company_name: string
          company_slug: string
          compliance_acknowledged_at?: string | null
          compliance_acknowledged_by?: string | null
          created_at?: string
          created_by?: string | null
          display_name: string
          ending?: string
          host_profile_id?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          organization_id: string
          status?: string
          template_version?: number
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          about?: string | null
          company_name?: string
          company_slug?: string
          compliance_acknowledged_at?: string | null
          compliance_acknowledged_by?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          ending?: string
          host_profile_id?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          organization_id?: string
          status?: string
          template_version?: number
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ir_agents_compliance_acknowledged_by_fkey"
            columns: ["compliance_acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_agents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_agents_host_profile_id_fkey"
            columns: ["host_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_agents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_analytics_insights: {
        Row: {
          created_by: string | null
          drivers: Json
          generated_at: string
          id: string
          input_hash: string
          metric_key: string
          model: string | null
          narrative: string
          suggested_actions: Json
        }
        Insert: {
          created_by?: string | null
          drivers?: Json
          generated_at?: string
          id?: string
          input_hash: string
          metric_key: string
          model?: string | null
          narrative: string
          suggested_actions?: Json
        }
        Update: {
          created_by?: string | null
          drivers?: Json
          generated_at?: string
          id?: string
          input_hash?: string
          metric_key?: string
          model?: string | null
          narrative?: string
          suggested_actions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ir_analytics_insights_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_goals: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string | null
          id: string
          metric: string
          period_end: string
          period_kind: string
          period_start: string
          project_id: string | null
          target: number
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metric: string
          period_end: string
          period_kind: string
          period_start: string
          project_id?: string | null
          target: number
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metric?: string
          period_end?: string
          period_kind?: string
          period_start?: string
          project_id?: string | null
          target?: number
        }
        Relationships: [
          {
            foreignKeyName: "ir_goals_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_goals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ir_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_match_stage_events: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_stage: string | null
          id: number
          match_id: string
          to_stage: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_stage?: string | null
          id?: number
          match_id: string
          to_stage: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_stage?: string | null
          id?: number
          match_id?: string
          to_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "ir_match_stage_events_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_match_stage_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "ir_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_matches: {
        Row: {
          assignee_id: string | null
          blockers: Json
          created_at: string
          created_by: string | null
          data_source: string | null
          fit_tier: string | null
          founder_visible: boolean
          id: string
          investor_contact_id: string
          meeting_booking_id: string | null
          milestone_id: string | null
          odoo_tag: string | null
          project_id: string
          stage: string
          stage_changed_at: string
          starred: boolean
          task_id: string | null
          term_sheet_received_at: string | null
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          blockers?: Json
          created_at?: string
          created_by?: string | null
          data_source?: string | null
          fit_tier?: string | null
          founder_visible?: boolean
          id?: string
          investor_contact_id: string
          meeting_booking_id?: string | null
          milestone_id?: string | null
          odoo_tag?: string | null
          project_id: string
          stage?: string
          stage_changed_at?: string
          starred?: boolean
          task_id?: string | null
          term_sheet_received_at?: string | null
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          blockers?: Json
          created_at?: string
          created_by?: string | null
          data_source?: string | null
          fit_tier?: string | null
          founder_visible?: boolean
          id?: string
          investor_contact_id?: string
          meeting_booking_id?: string | null
          milestone_id?: string | null
          odoo_tag?: string | null
          project_id?: string
          stage?: string
          stage_changed_at?: string
          starred?: boolean
          task_id?: string | null
          term_sheet_received_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ir_matches_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_matches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_matches_investor_contact_id_fkey"
            columns: ["investor_contact_id"]
            isOneToOne: false
            referencedRelation: "contact_sides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_matches_investor_contact_id_fkey"
            columns: ["investor_contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_matches_investor_contact_id_fkey"
            columns: ["investor_contact_id"]
            isOneToOne: false
            referencedRelation: "hot_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_matches_investor_contact_id_fkey"
            columns: ["investor_contact_id"]
            isOneToOne: false
            referencedRelation: "lead_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_matches_investor_contact_id_fkey"
            columns: ["investor_contact_id"]
            isOneToOne: false
            referencedRelation: "match_campaign_founder_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_matches_meeting_booking_id_fkey"
            columns: ["meeting_booking_id"]
            isOneToOne: false
            referencedRelation: "scheduling_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_matches_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "ir_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_matches_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ir_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_matches_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "ir_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_milestones: {
        Row: {
          completed_at: string | null
          ends_on: string
          id: string
          kind: string
          label: string
          parent_id: string | null
          project_id: string
          sort_order: number
          starts_on: string
        }
        Insert: {
          completed_at?: string | null
          ends_on: string
          id?: string
          kind: string
          label: string
          parent_id?: string | null
          project_id: string
          sort_order: number
          starts_on: string
        }
        Update: {
          completed_at?: string | null
          ends_on?: string
          id?: string
          kind?: string
          label?: string
          parent_id?: string | null
          project_id?: string
          sort_order?: number
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "ir_milestones_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "ir_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ir_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_notes: {
        Row: {
          body: string
          created_at: string
          created_by: string
          founder_visible: boolean
          id: string
          match_id: string | null
          noted_on: string
          project_id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          founder_visible?: boolean
          id?: string
          match_id?: string | null
          noted_on?: string
          project_id: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          founder_visible?: boolean
          id?: string
          match_id?: string | null
          noted_on?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ir_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_notes_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "ir_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ir_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_projects: {
        Row: {
          color: string | null
          company_id: string | null
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          founder_contact_id: string | null
          founder_name: string | null
          founder_report_visible: boolean
          id: string
          is_spv: boolean
          monthly_summary: boolean
          odoo_project_ids: number[] | null
          owner_id: string
          source_opportunity_id: string | null
          starred: boolean
          start_date: string
          status: string
          term_months: number
          title: string
          updated_at: string
          weekly_summary: boolean
        }
        Insert: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          founder_contact_id?: string | null
          founder_name?: string | null
          founder_report_visible?: boolean
          id?: string
          is_spv?: boolean
          monthly_summary?: boolean
          odoo_project_ids?: number[] | null
          owner_id: string
          source_opportunity_id?: string | null
          starred?: boolean
          start_date: string
          status?: string
          term_months: number
          title: string
          updated_at?: string
          weekly_summary?: boolean
        }
        Update: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          founder_contact_id?: string | null
          founder_name?: string | null
          founder_report_visible?: boolean
          id?: string
          is_spv?: boolean
          monthly_summary?: boolean
          odoo_project_ids?: number[] | null
          owner_id?: string
          source_opportunity_id?: string | null
          starred?: boolean
          start_date?: string
          status?: string
          term_months?: number
          title?: string
          updated_at?: string
          weekly_summary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ir_projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_projects_founder_contact_id_fkey"
            columns: ["founder_contact_id"]
            isOneToOne: false
            referencedRelation: "contact_sides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_projects_founder_contact_id_fkey"
            columns: ["founder_contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_projects_founder_contact_id_fkey"
            columns: ["founder_contact_id"]
            isOneToOne: false
            referencedRelation: "hot_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_projects_founder_contact_id_fkey"
            columns: ["founder_contact_id"]
            isOneToOne: false
            referencedRelation: "lead_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_projects_founder_contact_id_fkey"
            columns: ["founder_contact_id"]
            isOneToOne: false
            referencedRelation: "match_campaign_founder_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_projects_source_opportunity_id_fkey"
            columns: ["source_opportunity_id"]
            isOneToOne: false
            referencedRelation: "sales_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_reports: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          exec_summary: Json
          id: string
          metrics: Json
          pdf_path: string | null
          period_end: string
          period_kind: string
          period_start: string
          project_id: string
          sent_at: string | null
          sent_to: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          exec_summary?: Json
          id?: string
          metrics?: Json
          pdf_path?: string | null
          period_end: string
          period_kind: string
          period_start: string
          project_id: string
          sent_at?: string | null
          sent_to?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          exec_summary?: Json
          id?: string
          metrics?: Json
          pdf_path?: string | null
          period_end?: string
          period_kind?: string
          period_start?: string
          project_id?: string
          sent_at?: string | null
          sent_to?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ir_reports_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ir_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_sequence_enrollments: {
        Row: {
          created_at: string
          created_by: string
          id: string
          include_one_pager: boolean
          last_error: string | null
          manager_id: string
          match_id: string
          next_send_at: string | null
          next_step: number
          notify_email: boolean
          notify_events: string[]
          project_id: string
          started_at: string
          status: string
          steps: Json
          stop_on: string[]
          stop_reason: string | null
          template: string
          updated_at: string
          via: string
          watcher_ids: string[]
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          include_one_pager?: boolean
          last_error?: string | null
          manager_id: string
          match_id: string
          next_send_at?: string | null
          next_step?: number
          notify_email?: boolean
          notify_events?: string[]
          project_id: string
          started_at?: string
          status?: string
          steps: Json
          stop_on?: string[]
          stop_reason?: string | null
          template: string
          updated_at?: string
          via: string
          watcher_ids?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          include_one_pager?: boolean
          last_error?: string | null
          manager_id?: string
          match_id?: string
          next_send_at?: string | null
          next_step?: number
          notify_email?: boolean
          notify_events?: string[]
          project_id?: string
          started_at?: string
          status?: string
          steps?: Json
          stop_on?: string[]
          stop_reason?: string | null
          template?: string
          updated_at?: string
          via?: string
          watcher_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "ir_sequence_enrollments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_sequence_enrollments_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_sequence_enrollments_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "ir_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_sequence_enrollments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ir_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_sequence_events: {
        Row: {
          created_at: string
          created_by: string | null
          detail: string | null
          enrollment_id: string
          id: string
          kind: string
          match_id: string
          step: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          detail?: string | null
          enrollment_id: string
          id?: string
          kind: string
          match_id: string
          step?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          detail?: string | null
          enrollment_id?: string
          id?: string
          kind?: string
          match_id?: string
          step?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ir_sequence_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_sequence_events_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "ir_sequence_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_sequence_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "ir_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_sequence_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          steps: Json
          stop_on: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          steps: Json
          stop_on?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          steps?: Json
          stop_on?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ir_sequence_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_share_links: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string
          document_id: string | null
          expires_at: string | null
          file_name: string | null
          file_path: string | null
          id: string
          kind: string
          project_id: string
          recipients: string[]
          revoked_at: string | null
          token: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by: string
          document_id?: string | null
          expires_at?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          kind: string
          project_id: string
          recipients?: string[]
          revoked_at?: string | null
          token: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string
          document_id?: string | null
          expires_at?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          kind?: string
          project_id?: string
          recipients?: string[]
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "ir_share_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_share_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_share_links_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_share_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ir_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_share_views: {
        Row: {
          action: string
          document_id: string | null
          email: string
          id: string
          link_id: string
          match_id: string | null
          viewed_at: string
        }
        Insert: {
          action: string
          document_id?: string | null
          email: string
          id?: string
          link_id: string
          match_id?: string | null
          viewed_at?: string
        }
        Update: {
          action?: string
          document_id?: string | null
          email?: string
          id?: string
          link_id?: string
          match_id?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ir_share_views_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "ir_share_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_share_views_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "ir_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_summary_sends: {
        Row: {
          id: string
          kind: string
          period_end: string
          period_start: string
          project_id: string
          sent_at: string
          sent_to: string
        }
        Insert: {
          id?: string
          kind: string
          period_end: string
          period_start: string
          project_id: string
          sent_at?: string
          sent_to: string
        }
        Update: {
          id?: string
          kind?: string
          period_end?: string
          period_start?: string
          project_id?: string
          sent_at?: string
          sent_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "ir_summary_sends_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ir_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_task_stages: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          project_id: string
          sequence: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          project_id: string
          sequence?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          project_id?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "ir_task_stages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ir_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ir_tasks: {
        Row: {
          archived_at: string | null
          assignee_id: string | null
          blockers: Json
          created_at: string
          deadline: string | null
          id: string
          milestone_id: string
          notes: string | null
          odoo_task_id: number | null
          project_id: string
          stage_id: string | null
          starred: boolean
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          assignee_id?: string | null
          blockers?: Json
          created_at?: string
          deadline?: string | null
          id?: string
          milestone_id: string
          notes?: string | null
          odoo_task_id?: number | null
          project_id: string
          stage_id?: string | null
          starred?: boolean
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          assignee_id?: string | null
          blockers?: Json
          created_at?: string
          deadline?: string | null
          id?: string
          milestone_id?: string
          notes?: string | null
          odoo_task_id?: number | null
          project_id?: string
          stage_id?: string | null
          starred?: boolean
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ir_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_tasks_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "ir_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ir_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ir_tasks_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "ir_task_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      job_deliveries: {
        Row: {
          body_html: string | null
          channel: string
          created_at: string
          error: string | null
          id: number
          job: string
          message: string | null
          recipient_user_id: string | null
          run_id: number | null
          status: string
          subject: string
          to_email: string | null
        }
        Insert: {
          body_html?: string | null
          channel: string
          created_at?: string
          error?: string | null
          id?: number
          job: string
          message?: string | null
          recipient_user_id?: string | null
          run_id?: number | null
          status: string
          subject: string
          to_email?: string | null
        }
        Update: {
          body_html?: string | null
          channel?: string
          created_at?: string
          error?: string | null
          id?: number
          job?: string
          message?: string | null
          recipient_user_id?: string | null
          run_id?: number | null
          status?: string
          subject?: string
          to_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_deliveries_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_claims: {
        Row: {
          claimed_at: string
          company_id: string | null
          crm_contact_id: string | null
          email: string
          id: string
          partner_code: string | null
          profile_id: string | null
        }
        Insert: {
          claimed_at?: string
          company_id?: string | null
          crm_contact_id?: string | null
          email: string
          id?: string
          partner_code?: string | null
          profile_id?: string | null
        }
        Update: {
          claimed_at?: string
          company_id?: string | null
          crm_contact_id?: string | null
          email?: string
          id?: string
          partner_code?: string | null
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_claims_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_claims_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "contact_sides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_claims_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_claims_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "hot_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_claims_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "lead_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_claims_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "match_campaign_founder_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_claims_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_badges: {
        Row: {
          created_at: string
          criteria_type: string
          criteria_value: number
          description: string
          icon_name: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          criteria_type: string
          criteria_value: number
          description: string
          icon_name: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          criteria_type?: string
          criteria_value?: number
          description?: string
          icon_name?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      learning_certificates: {
        Row: {
          certificate_code: string
          certificate_title: string
          company_id: string | null
          created_at: string
          founder_id: string
          id: string
          issued_at: string
          issued_by: string | null
          metadata: Json | null
          program_id: string | null
          status: string
        }
        Insert: {
          certificate_code: string
          certificate_title: string
          company_id?: string | null
          created_at?: string
          founder_id: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          metadata?: Json | null
          program_id?: string | null
          status?: string
        }
        Update: {
          certificate_code?: string
          certificate_title?: string
          company_id?: string | null
          created_at?: string
          founder_id?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          metadata?: Json | null
          program_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_certificates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_certificates_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_certificates_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_certificates_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "learning_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_content_approvals: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          from_status: string
          id: string
          notes: string | null
          reviewer_id: string
          to_status: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          from_status: string
          id?: string
          notes?: string | null
          reviewer_id: string
          to_status: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          from_status?: string
          id?: string
          notes?: string | null
          reviewer_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_content_approvals_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_course_progress: {
        Row: {
          company_id: string
          completed_at: string | null
          founder_id: string
          id: string
          last_viewed_at: string | null
          program_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          founder_id: string
          id?: string
          last_viewed_at?: string | null
          program_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          founder_id?: string
          id?: string
          last_viewed_at?: string | null
          program_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_course_progress_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_course_progress_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_course_progress_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "learning_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_course_schedules: {
        Row: {
          company_id: string
          created_at: string
          days_per_week: number
          founder_id: string
          id: string
          inactivity_nudge: boolean
          preferred_time: string
          reminders_on: boolean
          session_minutes: number
          study_days: string[]
          updated_at: string
          weekly_digest: boolean
        }
        Insert: {
          company_id: string
          created_at?: string
          days_per_week?: number
          founder_id: string
          id?: string
          inactivity_nudge?: boolean
          preferred_time?: string
          reminders_on?: boolean
          session_minutes?: number
          study_days?: string[]
          updated_at?: string
          weekly_digest?: boolean
        }
        Update: {
          company_id?: string
          created_at?: string
          days_per_week?: number
          founder_id?: string
          id?: string
          inactivity_nudge?: boolean
          preferred_time?: string
          reminders_on?: boolean
          session_minutes?: number
          study_days?: string[]
          updated_at?: string
          weekly_digest?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "learning_course_schedules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_course_schedules_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_deliverable_submissions: {
        Row: {
          ai_feedback: string | null
          ai_score: number | null
          capital_stage: string
          company_id: string
          content_text: string | null
          created_at: string
          deliverable_id: string
          file_url: string | null
          founder_id: string
          id: string
          scored_at: string | null
          submitted_at: string
        }
        Insert: {
          ai_feedback?: string | null
          ai_score?: number | null
          capital_stage: string
          company_id: string
          content_text?: string | null
          created_at?: string
          deliverable_id: string
          file_url?: string | null
          founder_id: string
          id?: string
          scored_at?: string | null
          submitted_at?: string
        }
        Update: {
          ai_feedback?: string | null
          ai_score?: number | null
          capital_stage?: string
          company_id?: string
          content_text?: string | null
          created_at?: string
          deliverable_id?: string
          file_url?: string | null
          founder_id?: string
          id?: string
          scored_at?: string | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_deliverable_submissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_deliverable_submissions_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_lesson_content: {
        Row: {
          id: string
          key_points: Json | null
          lesson_id: string
          module_slug: string
          summary: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
          worksheet_prompt: string | null
        }
        Insert: {
          id?: string
          key_points?: Json | null
          lesson_id: string
          module_slug: string
          summary?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          worksheet_prompt?: string | null
        }
        Update: {
          id?: string
          key_points?: Json | null
          lesson_id?: string
          module_slug?: string
          summary?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          worksheet_prompt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_lesson_content_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_lessons: {
        Row: {
          body_markdown: string
          content_status: string
          created_at: string
          created_by: string | null
          estimated_time_minutes: number
          id: string
          lesson_key: string
          module_id: string | null
          module_slug: string
          order_index: number
          slide_deck_url: string | null
          title: string
          updated_at: string
          updated_by: string | null
          video_render_status: string | null
          video_url: string | null
        }
        Insert: {
          body_markdown?: string
          content_status?: string
          created_at?: string
          created_by?: string | null
          estimated_time_minutes?: number
          id?: string
          lesson_key: string
          module_id?: string | null
          module_slug: string
          order_index?: number
          slide_deck_url?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          video_render_status?: string | null
          video_url?: string | null
        }
        Update: {
          body_markdown?: string
          content_status?: string
          created_at?: string
          created_by?: string | null
          estimated_time_minutes?: number
          id?: string
          lesson_key?: string
          module_id?: string | null
          module_slug?: string
          order_index?: number
          slide_deck_url?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          video_render_status?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_lessons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "learning_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_lessons_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_modules: {
        Row: {
          category: string
          content_status: string
          created_at: string
          description: string
          difficulty: string
          estimated_time_minutes: number
          id: string
          is_published: boolean
          order_index: number
          readiness_stage: string
          related_remediation_category: string | null
          required_plan: string
          score_points: number
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          content_status?: string
          created_at?: string
          description: string
          difficulty?: string
          estimated_time_minutes?: number
          id?: string
          is_published?: boolean
          order_index?: number
          readiness_stage: string
          related_remediation_category?: string | null
          required_plan?: string
          score_points?: number
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content_status?: string
          created_at?: string
          description?: string
          difficulty?: string
          estimated_time_minutes?: number
          id?: string
          is_published?: boolean
          order_index?: number
          readiness_stage?: string
          related_remediation_category?: string | null
          required_plan?: string
          score_points?: number
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      learning_program_modules: {
        Row: {
          module_id: string
          order_index: number
          program_id: string
        }
        Insert: {
          module_id: string
          order_index?: number
          program_id: string
        }
        Update: {
          module_id?: string
          order_index?: number
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_program_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "learning_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_program_modules_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "learning_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_programs: {
        Row: {
          banner_image_url: string | null
          category: string | null
          content_status: string
          created_at: string
          description: string
          difficulty: string | null
          id: string
          is_published: boolean
          order_index: number
          readiness_focus: string
          slug: string
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          banner_image_url?: string | null
          category?: string | null
          content_status?: string
          created_at?: string
          description: string
          difficulty?: string | null
          id?: string
          is_published?: boolean
          order_index?: number
          readiness_focus: string
          slug: string
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          banner_image_url?: string | null
          category?: string | null
          content_status?: string
          created_at?: string
          description?: string
          difficulty?: string | null
          id?: string
          is_published?: boolean
          order_index?: number
          readiness_focus?: string
          slug?: string
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      learning_progress: {
        Row: {
          company_id: string
          completed_at: string | null
          founder_id: string
          id: string
          last_viewed_at: string | null
          module_id: string
          percent_complete: number
          started_at: string | null
          status: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          founder_id: string
          id?: string
          last_viewed_at?: string | null
          module_id: string
          percent_complete?: number
          started_at?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          founder_id?: string
          id?: string
          last_viewed_at?: string | null
          module_id?: string
          percent_complete?: number
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_progress_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_progress_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "learning_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_quiz_questions: {
        Row: {
          correct_option_index: number
          created_at: string
          id: string
          options: Json
          order_index: number
          prompt: string
          quiz_id: string
          updated_at: string
        }
        Insert: {
          correct_option_index?: number
          created_at?: string
          id?: string
          options?: Json
          order_index?: number
          prompt: string
          quiz_id: string
          updated_at?: string
        }
        Update: {
          correct_option_index?: number
          created_at?: string
          id?: string
          options?: Json
          order_index?: number
          prompt?: string
          quiz_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "learning_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_quizzes: {
        Row: {
          content_status: string
          created_at: string
          created_by: string | null
          id: string
          lesson_id: string | null
          module_id: string | null
          passing_score: number
          program_id: string | null
          retry_limit: number | null
          scope_type: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content_status?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lesson_id?: string | null
          module_id?: string | null
          passing_score?: number
          program_id?: string | null
          retry_limit?: number | null
          scope_type?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content_status?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lesson_id?: string | null
          module_id?: string | null
          passing_score?: number
          program_id?: string | null
          retry_limit?: number | null
          scope_type?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_quizzes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "learning_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_quizzes_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "learning_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_quizzes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "learning_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_quizzes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_reminders: {
        Row: {
          company_id: string
          created_at: string
          founder_id: string
          id: string
          metadata: Json
          scheduled_at: string
          sent_at: string | null
          type: string
        }
        Insert: {
          company_id: string
          created_at?: string
          founder_id: string
          id?: string
          metadata?: Json
          scheduled_at: string
          sent_at?: string | null
          type: string
        }
        Update: {
          company_id?: string
          created_at?: string
          founder_id?: string
          id?: string
          metadata?: Json
          scheduled_at?: string
          sent_at?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_reminders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_reminders_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_user_badges: {
        Row: {
          badge_id: string
          company_id: string
          earned_at: string
          founder_id: string
          id: string
        }
        Insert: {
          badge_id: string
          company_id: string
          earned_at?: string
          founder_id: string
          id?: string
        }
        Update: {
          badge_id?: string
          company_id?: string
          earned_at?: string
          founder_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "learning_badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_user_badges_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_user_badges_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_deal_notices: {
        Row: {
          company_id: string
          created_at: string
          crm_contact_id: string
          error: string | null
          id: string
          investor_profile_id: string | null
          match_score: number | null
          opted_in_at: string | null
          sent_at: string | null
          status: string
          token: string
          viewed_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          crm_contact_id: string
          error?: string | null
          id?: string
          investor_profile_id?: string | null
          match_score?: number | null
          opted_in_at?: string | null
          sent_at?: string | null
          status?: string
          token: string
          viewed_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          crm_contact_id?: string
          error?: string | null
          id?: string
          investor_profile_id?: string | null
          match_score?: number | null
          opted_in_at?: string | null
          sent_at?: string | null
          status?: string
          token?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_deal_notices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_deal_notices_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "contact_sides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_deal_notices_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_deal_notices_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "hot_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_deal_notices_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "lead_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_deal_notices_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "match_campaign_founder_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_deal_notices_investor_profile_id_fkey"
            columns: ["investor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_interest: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          intended_amount_text: string | null
          ip_hash: string | null
          listing_id: string
          source: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          intended_amount_text?: string | null
          ip_hash?: string | null
          listing_id: string
          source?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          intended_amount_text?: string | null
          ip_hash?: string | null
          listing_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_interest_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      lounge_messages: {
        Row: {
          body: string
          created_at: string
          event_id: string
          id: string
          profile_id: string
          table_id: string
        }
        Insert: {
          body: string
          created_at?: string
          event_id: string
          id?: string
          profile_id: string
          table_id: string
        }
        Update: {
          body?: string
          created_at?: string
          event_id?: string
          id?: string
          profile_id?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lounge_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lounge_messages_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lounge_messages_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "lounge_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      lounge_tables: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          sector_slug: string | null
          title: string
          topic: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          sector_slug?: string | null
          title: string
          topic?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          sector_slug?: string | null
          title?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lounge_tables_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lounge_tables_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_outreach_sends: {
        Row: {
          company_id: string
          email: string | null
          founder_id: string | null
          id: number
          recipient_id: string | null
          sent_at: string
          step_index: number | null
        }
        Insert: {
          company_id: string
          email?: string | null
          founder_id?: string | null
          id?: never
          recipient_id?: string | null
          sent_at?: string
          step_index?: number | null
        }
        Update: {
          company_id?: string
          email?: string | null
          founder_id?: string | null
          id?: never
          recipient_id?: string | null
          sent_at?: string
          step_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_outreach_sends_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_outreach_sends_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_outreach_sends_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "founder_manual_outreach_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      market_claim_reports: {
        Row: {
          company_id: string
          report: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          report: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          report?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_claim_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          archived: boolean
          body_override: string | null
          created_at: string
          created_by: string | null
          department: string | null
          event_email_type: string | null
          event_id: string | null
          from_email: string
          from_name: string
          group_type: string | null
          id: string
          list_id: string | null
          match_config: Json | null
          merge_snapshot: Json | null
          name: string
          reply_to: string | null
          scheduled_at: string | null
          sent_at: string | null
          stat_bounced: number
          stat_clicked: number
          stat_delivered: number
          stat_opened: number
          stat_replied: number
          stat_sent: number
          stat_spam: number
          stat_unsubscribed: number
          status: string
          subject_override: string | null
          template_id: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          body_override?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          event_email_type?: string | null
          event_id?: string | null
          from_email?: string
          from_name?: string
          group_type?: string | null
          id?: string
          list_id?: string | null
          match_config?: Json | null
          merge_snapshot?: Json | null
          name: string
          reply_to?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          stat_bounced?: number
          stat_clicked?: number
          stat_delivered?: number
          stat_opened?: number
          stat_replied?: number
          stat_sent?: number
          stat_spam?: number
          stat_unsubscribed?: number
          status?: string
          subject_override?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          body_override?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          event_email_type?: string | null
          event_id?: string | null
          from_email?: string
          from_name?: string
          group_type?: string | null
          id?: string
          list_id?: string | null
          match_config?: Json | null
          merge_snapshot?: Json | null
          name?: string
          reply_to?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          stat_bounced?: number
          stat_clicked?: number
          stat_delivered?: number
          stat_opened?: number
          stat_replied?: number
          stat_sent?: number
          stat_spam?: number
          stat_unsubscribed?: number
          status?: string
          subject_override?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_campaigns_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "marketing_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "marketing_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_contacts: {
        Row: {
          company: string | null
          created_at: string
          crm_contact_id: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          metadata: Json | null
          source: string | null
          tags: string[] | null
          title: string | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          crm_contact_id?: string | null
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          metadata?: Json | null
          source?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          crm_contact_id?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          metadata?: Json | null
          source?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_contacts_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "contact_sides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_contacts_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_contacts_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "hot_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_contacts_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "lead_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_contacts_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "match_campaign_founder_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_events: {
        Row: {
          campaign_id: string | null
          contact_id: string
          email: string
          event_type: string
          id: string
          metadata: Json | null
          occurred_at: string
          resend_id: string | null
          sequence_id: string | null
          step_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          contact_id: string
          email: string
          event_type: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          resend_id?: string | null
          sequence_id?: string | null
          step_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          contact_id?: string
          email?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          resend_id?: string | null
          sequence_id?: string | null
          step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "marketing_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_events_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "marketing_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_events_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "marketing_sequence_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_list_contacts: {
        Row: {
          added_at: string
          contact_id: string
          list_id: string
        }
        Insert: {
          added_at?: string
          contact_id: string
          list_id: string
        }
        Update: {
          added_at?: string
          contact_id?: string
          list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_list_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "marketing_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_list_contacts_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "marketing_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_lists: {
        Row: {
          archived: boolean
          created_at: string
          department: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_partner_enrollments: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          crm_contact_id: string | null
          current_step: number
          email: string | null
          evidence: string | null
          firm: string | null
          history: Json
          id: string
          name: string
          next_due_at: string | null
          phone: string | null
          rating: string
          sequence_id: string
          stage: string
          started_at: string | null
          stop_reason: string | null
          subject: string | null
          tier: number
          track: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          crm_contact_id?: string | null
          current_step?: number
          email?: string | null
          evidence?: string | null
          firm?: string | null
          history?: Json
          id?: string
          name: string
          next_due_at?: string | null
          phone?: string | null
          rating?: string
          sequence_id: string
          stage?: string
          started_at?: string | null
          stop_reason?: string | null
          subject?: string | null
          tier: number
          track?: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          crm_contact_id?: string | null
          current_step?: number
          email?: string | null
          evidence?: string | null
          firm?: string | null
          history?: Json
          id?: string
          name?: string
          next_due_at?: string | null
          phone?: string | null
          rating?: string
          sequence_id?: string
          stage?: string
          started_at?: string | null
          stop_reason?: string | null
          subject?: string | null
          tier?: number
          track?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_partner_enrollments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_partner_enrollments_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "contact_sides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_partner_enrollments_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_partner_enrollments_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "hot_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_partner_enrollments_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "lead_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_partner_enrollments_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "match_campaign_founder_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_partner_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "marketing_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_plan_items: {
        Row: {
          channel: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          plan_id: string
          priority: string
          sort_order: number
          start_date: string | null
          status: string
          task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          plan_id: string
          priority?: string
          sort_order?: number
          start_date?: string | null
          status?: string
          task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          plan_id?: string
          priority?: string
          sort_order?: number
          start_date?: string | null
          status?: string
          task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "marketing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_plan_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_plans: {
        Row: {
          budget: string | null
          created_at: string
          created_by: string | null
          end_date: string | null
          generated_by: string
          id: string
          name: string
          objective: string | null
          start_date: string | null
          status: string
          summary: string | null
          target_audience: string | null
          updated_at: string
        }
        Insert: {
          budget?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          generated_by?: string
          id?: string
          name: string
          objective?: string | null
          start_date?: string | null
          status?: string
          summary?: string | null
          target_audience?: string | null
          updated_at?: string
        }
        Update: {
          budget?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          generated_by?: string
          id?: string
          name?: string
          objective?: string | null
          start_date?: string | null
          status?: string
          summary?: string | null
          target_audience?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      marketing_saved_searches: {
        Row: {
          columns: string[] | null
          created_at: string
          group_by: string | null
          id: string
          is_default: boolean
          is_shared: boolean
          name: string
          owner_id: string | null
          scope: string
          spec: Json
          updated_at: string
        }
        Insert: {
          columns?: string[] | null
          created_at?: string
          group_by?: string | null
          id?: string
          is_default?: boolean
          is_shared?: boolean
          name: string
          owner_id?: string | null
          scope?: string
          spec?: Json
          updated_at?: string
        }
        Update: {
          columns?: string[] | null
          created_at?: string
          group_by?: string | null
          id?: string
          is_default?: boolean
          is_shared?: boolean
          name?: string
          owner_id?: string | null
          scope?: string
          spec?: Json
          updated_at?: string
        }
        Relationships: []
      }
      marketing_sequence_batches: {
        Row: {
          approver_id: string | null
          created_at: string
          eligible_count: number
          id: string
          on_hold: boolean
          released_at: string | null
          released_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          send_after: string | null
          sequence_id: string
          skipped_count: number
          status: string
          step_id: string | null
          step_order: number
          suppressed_count: number
          will_send_count: number
        }
        Insert: {
          approver_id?: string | null
          created_at?: string
          eligible_count?: number
          id?: string
          on_hold?: boolean
          released_at?: string | null
          released_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          send_after?: string | null
          sequence_id: string
          skipped_count?: number
          status?: string
          step_id?: string | null
          step_order?: number
          suppressed_count?: number
          will_send_count?: number
        }
        Update: {
          approver_id?: string | null
          created_at?: string
          eligible_count?: number
          id?: string
          on_hold?: boolean
          released_at?: string | null
          released_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          send_after?: string | null
          sequence_id?: string
          skipped_count?: number
          status?: string
          step_id?: string | null
          step_order?: number
          suppressed_count?: number
          will_send_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketing_sequence_batches_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_sequence_batches_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_sequence_batches_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_sequence_batches_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "marketing_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_sequence_batches_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "marketing_sequence_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_sequence_enrollments: {
        Row: {
          batch_id: string | null
          contact_id: string
          current_step: number
          enrolled_at: string
          id: string
          next_send_at: string | null
          sequence_id: string
          status: string
        }
        Insert: {
          batch_id?: string | null
          contact_id: string
          current_step?: number
          enrolled_at?: string
          id?: string
          next_send_at?: string | null
          sequence_id: string
          status?: string
        }
        Update: {
          batch_id?: string | null
          contact_id?: string
          current_step?: number
          enrolled_at?: string
          id?: string
          next_send_at?: string | null
          sequence_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_sequence_enrollments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "marketing_sequence_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_sequence_enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "marketing_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "marketing_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_sequence_schedules: {
        Row: {
          activated_at: string
          created_at: string
          enabled: boolean
          end_date: string | null
          last_reminder_for: string | null
          last_run_for: string | null
          max_per_run: number
          reminder_minutes: number
          repeat: string
          run_done: boolean
          run_sent: number
          send_time: string
          sequence_id: string
          start_date: string
          timezone: string
          unreviewed_action: string
          updated_at: string
          updated_by: string | null
          weekdays: number[]
        }
        Insert: {
          activated_at?: string
          created_at?: string
          enabled?: boolean
          end_date?: string | null
          last_reminder_for?: string | null
          last_run_for?: string | null
          max_per_run?: number
          reminder_minutes?: number
          repeat?: string
          run_done?: boolean
          run_sent?: number
          send_time?: string
          sequence_id: string
          start_date: string
          timezone?: string
          unreviewed_action?: string
          updated_at?: string
          updated_by?: string | null
          weekdays?: number[]
        }
        Update: {
          activated_at?: string
          created_at?: string
          enabled?: boolean
          end_date?: string | null
          last_reminder_for?: string | null
          last_run_for?: string | null
          max_per_run?: number
          reminder_minutes?: number
          repeat?: string
          run_done?: boolean
          run_sent?: number
          send_time?: string
          sequence_id?: string
          start_date?: string
          timezone?: string
          unreviewed_action?: string
          updated_at?: string
          updated_by?: string | null
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "marketing_sequence_schedules_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: true
            referencedRelation: "marketing_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_sequence_schedules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_sequence_steps: {
        Row: {
          condition: string
          created_at: string
          delay_days: number
          from_email: string
          from_name: string
          id: string
          sequence_id: string
          step_order: number
          template_id: string | null
        }
        Insert: {
          condition?: string
          created_at?: string
          delay_days?: number
          from_email?: string
          from_name?: string
          id?: string
          sequence_id: string
          step_order: number
          template_id?: string | null
        }
        Update: {
          condition?: string
          created_at?: string
          delay_days?: number
          from_email?: string
          from_name?: string
          id?: string
          sequence_id?: string
          step_order?: number
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "marketing_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_sequence_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "marketing_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_sequences: {
        Row: {
          approver_id: string | null
          created_at: string
          created_by: string | null
          department: string | null
          id: string
          kind: string
          name: string
          partner_config: Json
          status: string
          updated_at: string
        }
        Insert: {
          approver_id?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          kind?: string
          name: string
          partner_config?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          approver_id?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          id?: string
          kind?: string
          name?: string
          partner_config?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_sequences_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_settings: {
        Row: {
          default_from_email: string
          default_from_name: string
          default_reply_to: string | null
          finder_retention_months: number
          id: string
          senders: Json
          updated_at: string
        }
        Insert: {
          default_from_email?: string
          default_from_name?: string
          default_reply_to?: string | null
          finder_retention_months?: number
          id?: string
          senders?: Json
          updated_at?: string
        }
        Update: {
          default_from_email?: string
          default_from_name?: string
          default_reply_to?: string | null
          finder_retention_months?: number
          id?: string
          senders?: Json
          updated_at?: string
        }
        Relationships: []
      }
      marketing_site_demo_bookings: {
        Row: {
          ai_session_id: string | null
          company: string | null
          created_at: string | null
          duration_minutes: number | null
          email: string
          id: string
          name: string
          requested_at: string
          role: string
          source_page: string | null
          status: string | null
          topic: string | null
        }
        Insert: {
          ai_session_id?: string | null
          company?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          email: string
          id?: string
          name: string
          requested_at: string
          role: string
          source_page?: string | null
          status?: string | null
          topic?: string | null
        }
        Update: {
          ai_session_id?: string | null
          company?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          email?: string
          id?: string
          name?: string
          requested_at?: string
          role?: string
          source_page?: string | null
          status?: string | null
          topic?: string | null
        }
        Relationships: []
      }
      marketing_site_events: {
        Row: {
          banner_url: string | null
          city: string | null
          ends_at: string | null
          id: string
          kind: string | null
          registration_open: boolean | null
          sort_order: number | null
          starts_at: string | null
          title: string
        }
        Insert: {
          banner_url?: string | null
          city?: string | null
          ends_at?: string | null
          id?: string
          kind?: string | null
          registration_open?: boolean | null
          sort_order?: number | null
          starts_at?: string | null
          title: string
        }
        Update: {
          banner_url?: string | null
          city?: string | null
          ends_at?: string | null
          id?: string
          kind?: string | null
          registration_open?: boolean | null
          sort_order?: number | null
          starts_at?: string | null
          title?: string
        }
        Relationships: []
      }
      marketing_site_leads: {
        Row: {
          capital_structure: string | null
          company: string | null
          created_at: string | null
          details: Json | null
          email: string
          id: string
          name: string | null
          raise_target: string | null
          role: string | null
          source_page: string | null
          stage: string | null
          start_choice: string | null
          utm: Json | null
          website: string | null
        }
        Insert: {
          capital_structure?: string | null
          company?: string | null
          created_at?: string | null
          details?: Json | null
          email: string
          id?: string
          name?: string | null
          raise_target?: string | null
          role?: string | null
          source_page?: string | null
          stage?: string | null
          start_choice?: string | null
          utm?: Json | null
          website?: string | null
        }
        Update: {
          capital_structure?: string | null
          company?: string | null
          created_at?: string | null
          details?: Json | null
          email?: string
          id?: string
          name?: string | null
          raise_target?: string | null
          role?: string | null
          source_page?: string | null
          stage?: string | null
          start_choice?: string | null
          utm?: Json | null
          website?: string | null
        }
        Relationships: []
      }
      marketing_site_logos: {
        Row: {
          active: boolean | null
          id: string
          logo_url: string
          name: string
          sort_order: number | null
        }
        Insert: {
          active?: boolean | null
          id?: string
          logo_url: string
          name: string
          sort_order?: number | null
        }
        Update: {
          active?: boolean | null
          id?: string
          logo_url?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      marketing_templates: {
        Row: {
          blocks: Json | null
          category: string
          created_at: string
          created_by: string | null
          department: string | null
          html_body: string
          id: string
          name: string
          preview_text: string | null
          status: string
          subject: string
          text_body: string | null
          updated_at: string
        }
        Insert: {
          blocks?: Json | null
          category?: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          html_body: string
          id?: string
          name: string
          preview_text?: string | null
          status?: string
          subject: string
          text_body?: string | null
          updated_at?: string
        }
        Update: {
          blocks?: Json | null
          category?: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          html_body?: string
          id?: string
          name?: string
          preview_text?: string | null
          status?: string
          subject?: string
          text_body?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      marketing_unsubscribes: {
        Row: {
          email: string
          reason: string | null
          unsubscribed_at: string
        }
        Insert: {
          email: string
          reason?: string | null
          unsubscribed_at?: string
        }
        Update: {
          email?: string
          reason?: string | null
          unsubscribed_at?: string
        }
        Relationships: []
      }
      marketing_webhook_log: {
        Row: {
          detail: string | null
          event_type: string | null
          id: string
          outcome: string
          received_at: string
          verified: boolean
        }
        Insert: {
          detail?: string | null
          event_type?: string | null
          id?: string
          outcome: string
          received_at?: string
          verified?: boolean
        }
        Update: {
          detail?: string | null
          event_type?: string | null
          id?: string
          outcome?: string
          received_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      marketplace_listings: {
        Row: {
          brief_description: string
          closed_at: string | null
          company_id: string
          company_name: string
          created_at: string
          id: string
          industry: string | null
          location: string | null
          logo_path: string | null
          offering_amount_max: number | null
          offering_amount_min: number | null
          portal_name: string
          portal_url: string
          published_at: string | null
          readiness_band: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          security_type: string | null
          slug: string | null
          status: Database["public"]["Enums"]["listing_status"]
          updated_at: string
        }
        Insert: {
          brief_description: string
          closed_at?: string | null
          company_id: string
          company_name: string
          created_at?: string
          id?: string
          industry?: string | null
          location?: string | null
          logo_path?: string | null
          offering_amount_max?: number | null
          offering_amount_min?: number | null
          portal_name: string
          portal_url: string
          published_at?: string | null
          readiness_band?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          security_type?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          updated_at?: string
        }
        Update: {
          brief_description?: string
          closed_at?: string | null
          company_id?: string
          company_name?: string
          created_at?: string
          id?: string
          industry?: string | null
          location?: string | null
          logo_path?: string | null
          offering_amount_max?: number | null
          offering_amount_min?: number | null
          portal_name?: string
          portal_url?: string
          published_at?: string | null
          readiness_band?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          security_type?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      match_campaign_followups: {
        Row: {
          campaign_founder_id: string
          channel: string
          created_at: string
          error: string | null
          id: string
          resend_id: string | null
          sales_task_id: string | null
          status: string
          step_key: string
        }
        Insert: {
          campaign_founder_id: string
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          resend_id?: string | null
          sales_task_id?: string | null
          status: string
          step_key: string
        }
        Update: {
          campaign_founder_id?: string
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          resend_id?: string | null
          sales_task_id?: string | null
          status?: string
          step_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_campaign_followups_campaign_founder_id_fkey"
            columns: ["campaign_founder_id"]
            isOneToOne: false
            referencedRelation: "match_campaign_founders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_campaign_followups_sales_task_id_fkey"
            columns: ["sales_task_id"]
            isOneToOne: false
            referencedRelation: "sales_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      match_campaign_founders: {
        Row: {
          booked_at: string | null
          booking_id: string | null
          campaign_id: string
          clicked_call_at: string | null
          clicked_intro_at: string | null
          cohort_key: string | null
          company: string | null
          created_at: string
          day0_match_count: number | null
          email: string | null
          excluded_note: string | null
          excluded_reason: string | null
          first_profile_view_at: string | null
          followup_branch: string | null
          followup_sent_at: string | null
          followup_status: string | null
          followup_step: number
          followup_stop_reason: string | null
          founder_contact_id: string
          founder_profile_id: string | null
          founder_type: string | null
          funding_stage: string | null
          id: string
          industry: string | null
          match_count: number
          message_id: string | null
          next_followup_at: string | null
          opened_page_at: string | null
          plan_started_at: string | null
          replied_at: string | null
          send_error: string | null
          send_status: string
          sent_at: string | null
          thread_message_id: string | null
          top_matches: Json
          updated_at: string
          variant: string | null
        }
        Insert: {
          booked_at?: string | null
          booking_id?: string | null
          campaign_id: string
          clicked_call_at?: string | null
          clicked_intro_at?: string | null
          cohort_key?: string | null
          company?: string | null
          created_at?: string
          day0_match_count?: number | null
          email?: string | null
          excluded_note?: string | null
          excluded_reason?: string | null
          first_profile_view_at?: string | null
          followup_branch?: string | null
          followup_sent_at?: string | null
          followup_status?: string | null
          followup_step?: number
          followup_stop_reason?: string | null
          founder_contact_id: string
          founder_profile_id?: string | null
          founder_type?: string | null
          funding_stage?: string | null
          id?: string
          industry?: string | null
          match_count?: number
          message_id?: string | null
          next_followup_at?: string | null
          opened_page_at?: string | null
          plan_started_at?: string | null
          replied_at?: string | null
          send_error?: string | null
          send_status?: string
          sent_at?: string | null
          thread_message_id?: string | null
          top_matches?: Json
          updated_at?: string
          variant?: string | null
        }
        Update: {
          booked_at?: string | null
          booking_id?: string | null
          campaign_id?: string
          clicked_call_at?: string | null
          clicked_intro_at?: string | null
          cohort_key?: string | null
          company?: string | null
          created_at?: string
          day0_match_count?: number | null
          email?: string | null
          excluded_note?: string | null
          excluded_reason?: string | null
          first_profile_view_at?: string | null
          followup_branch?: string | null
          followup_sent_at?: string | null
          followup_status?: string | null
          followup_step?: number
          followup_stop_reason?: string | null
          founder_contact_id?: string
          founder_profile_id?: string | null
          founder_type?: string | null
          funding_stage?: string | null
          id?: string
          industry?: string | null
          match_count?: number
          message_id?: string | null
          next_followup_at?: string | null
          opened_page_at?: string | null
          plan_started_at?: string | null
          replied_at?: string | null
          send_error?: string | null
          send_status?: string
          sent_at?: string | null
          thread_message_id?: string | null
          top_matches?: Json
          updated_at?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_campaign_founders_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_campaign_founders_founder_contact_id_fkey"
            columns: ["founder_contact_id"]
            isOneToOne: false
            referencedRelation: "contact_sides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_campaign_founders_founder_contact_id_fkey"
            columns: ["founder_contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_campaign_founders_founder_contact_id_fkey"
            columns: ["founder_contact_id"]
            isOneToOne: false
            referencedRelation: "hot_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_campaign_founders_founder_contact_id_fkey"
            columns: ["founder_contact_id"]
            isOneToOne: false
            referencedRelation: "lead_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_campaign_founders_founder_contact_id_fkey"
            columns: ["founder_contact_id"]
            isOneToOne: false
            referencedRelation: "match_campaign_founder_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_campaign_founders_founder_profile_id_fkey"
            columns: ["founder_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_campaign_investor_views: {
        Row: {
          campaign_founder_id: string
          first_viewed_at: string
          id: string
          last_viewed_at: string
          match_id: string
          view_count: number
        }
        Insert: {
          campaign_founder_id: string
          first_viewed_at?: string
          id?: string
          last_viewed_at?: string
          match_id: string
          view_count?: number
        }
        Update: {
          campaign_founder_id?: string
          first_viewed_at?: string
          id?: string
          last_viewed_at?: string
          match_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_campaign_investor_views_campaign_founder_id_fkey"
            columns: ["campaign_founder_id"]
            isOneToOne: false
            referencedRelation: "match_campaign_founders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_campaign_investor_views_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "match_campaign_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_campaign_matches: {
        Row: {
          campaign_founder_id: string
          check_band: string | null
          created_at: string
          id: string
          investor_contact_id: string
          investor_type: string | null
          match_score: number
          matched_sectors: string[]
          rank: number | null
          reasons: string[]
          removed: boolean
          removed_at: string | null
          removed_by: string | null
          sector_tier: string | null
          sectors: string[]
          stages: string[]
        }
        Insert: {
          campaign_founder_id: string
          check_band?: string | null
          created_at?: string
          id?: string
          investor_contact_id: string
          investor_type?: string | null
          match_score: number
          matched_sectors?: string[]
          rank?: number | null
          reasons?: string[]
          removed?: boolean
          removed_at?: string | null
          removed_by?: string | null
          sector_tier?: string | null
          sectors?: string[]
          stages?: string[]
        }
        Update: {
          campaign_founder_id?: string
          check_band?: string | null
          created_at?: string
          id?: string
          investor_contact_id?: string
          investor_type?: string | null
          match_score?: number
          matched_sectors?: string[]
          rank?: number | null
          reasons?: string[]
          removed?: boolean
          removed_at?: string | null
          removed_by?: string | null
          sector_tier?: string | null
          sectors?: string[]
          stages?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "match_campaign_matches_campaign_founder_id_fkey"
            columns: ["campaign_founder_id"]
            isOneToOne: false
            referencedRelation: "match_campaign_founders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_campaign_matches_investor_contact_id_fkey"
            columns: ["investor_contact_id"]
            isOneToOne: false
            referencedRelation: "contact_sides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_campaign_matches_investor_contact_id_fkey"
            columns: ["investor_contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_campaign_matches_investor_contact_id_fkey"
            columns: ["investor_contact_id"]
            isOneToOne: false
            referencedRelation: "hot_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_campaign_matches_investor_contact_id_fkey"
            columns: ["investor_contact_id"]
            isOneToOne: false
            referencedRelation: "lead_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_campaign_matches_investor_contact_id_fkey"
            columns: ["investor_contact_id"]
            isOneToOne: false
            referencedRelation: "match_campaign_founder_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_campaign_matches_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_campaign_profile_views: {
        Row: {
          campaign_founder_id: string
          id: string
          match_id: string
          viewed_at: string
        }
        Insert: {
          campaign_founder_id: string
          id?: string
          match_id: string
          viewed_at?: string
        }
        Update: {
          campaign_founder_id?: string
          id?: string
          match_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_campaign_profile_views_campaign_founder_id_fkey"
            columns: ["campaign_founder_id"]
            isOneToOne: false
            referencedRelation: "match_campaign_founders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_campaign_profile_views_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "match_campaign_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_sector_adjacency: {
        Row: {
          adjacent_industry: string
          created_at: string
          industry: string
        }
        Insert: {
          adjacent_industry: string
          created_at?: string
          industry: string
        }
        Update: {
          adjacent_industry?: string
          created_at?: string
          industry?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          created_at: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_activity_goals: {
        Row: {
          amount: number | null
          basis: string | null
          created_at: string
          created_by: string | null
          direction: string
          effective_month: string
          id: string
          metric_key: string
          note: string | null
          per_month: number | null
        }
        Insert: {
          amount?: number | null
          basis?: string | null
          created_at?: string
          created_by?: string | null
          direction?: string
          effective_month: string
          id?: string
          metric_key: string
          note?: string | null
          per_month?: number | null
        }
        Update: {
          amount?: number | null
          basis?: string | null
          created_at?: string
          created_by?: string | null
          direction?: string
          effective_month?: string
          id?: string
          metric_key?: string
          note?: string | null
          per_month?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "message_activity_goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          founder_id: string
          id: string
          intro_request_id: string | null
          investor_id: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          founder_id: string
          id?: string
          intro_request_id?: string | null
          investor_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          founder_id?: string
          id?: string
          intro_request_id?: string | null
          investor_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_intro_request_id_fkey"
            columns: ["intro_request_id"]
            isOneToOne: false
            referencedRelation: "intro_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_notification_prefs: {
        Row: {
          admin_id: string
          cadence: string | null
          channels: Json
          enabled: boolean
          type_id: string
          updated_at: string
        }
        Insert: {
          admin_id: string
          cadence?: string | null
          channels?: Json
          enabled: boolean
          type_id: string
          updated_at?: string
        }
        Update: {
          admin_id?: string
          cadence?: string | null
          channels?: Json
          enabled?: boolean
          type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_notification_prefs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_notification_prefs_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "mkt_notification_types"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_notification_settings: {
        Row: {
          admin_id: string
          default_channels: Json
          digest_time: string
          master_on: boolean
          quiet_end: string
          quiet_hours_on: boolean
          quiet_start: string
          timezone: string
          updated_at: string
        }
        Insert: {
          admin_id: string
          default_channels?: Json
          digest_time?: string
          master_on?: boolean
          quiet_end?: string
          quiet_hours_on?: boolean
          quiet_start?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          admin_id?: string
          default_channels?: Json
          digest_time?: string
          master_on?: boolean
          quiet_end?: string
          quiet_hours_on?: boolean
          quiet_start?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_notification_settings_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_notification_types: {
        Row: {
          default_cadence: string | null
          default_channels: Json
          default_on: boolean
          description: string
          group: string
          id: string
          kind: string
          label: string
          supports_cadence: boolean
          urgent: boolean
        }
        Insert: {
          default_cadence?: string | null
          default_channels?: Json
          default_on?: boolean
          description?: string
          group: string
          id: string
          kind: string
          label: string
          supports_cadence?: boolean
          urgent?: boolean
        }
        Update: {
          default_cadence?: string | null
          default_channels?: Json
          default_on?: boolean
          description?: string
          group?: string
          id?: string
          kind?: string
          label?: string
          supports_cadence?: boolean
          urgent?: boolean
        }
        Relationships: []
      }
      mkt_notifications: {
        Row: {
          admin_id: string
          body: string
          created_at: string
          dedupe_key: string | null
          id: string
          link: string | null
          meta: Json
          read_at: string | null
          title: string
          type_id: string
        }
        Insert: {
          admin_id: string
          body: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          link?: string | null
          meta?: Json
          read_at?: string | null
          title: string
          type_id: string
        }
        Update: {
          admin_id?: string
          body?: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          link?: string | null
          meta?: Json
          read_at?: string | null
          title?: string
          type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mkt_notifications_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mkt_notifications_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "mkt_notification_types"
            referencedColumns: ["id"]
          },
        ]
      }
      networking_connections: {
        Row: {
          created_at: string
          event_id: string
          from_id: string
          id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["networking_connection_status"]
          to_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          from_id: string
          id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["networking_connection_status"]
          to_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          from_id?: string
          id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["networking_connection_status"]
          to_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "networking_connections_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "networking_connections_from_id_fkey"
            columns: ["from_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "networking_connections_to_id_fkey"
            columns: ["to_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      networking_optins: {
        Row: {
          created_at: string
          event_id: string
          id: string
          interests: Json
          opted_in: boolean
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          interests?: Json
          opted_in?: boolean
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          interests?: Json
          opted_in?: boolean
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "networking_optins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "networking_optins_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      next_best_actions: {
        Row: {
          action_type: string
          blockers: Json
          category: string
          company_id: string | null
          completed_at: string | null
          created_at: string
          dedupe_key: string
          description: string
          dismissed_at: string | null
          due_at: string | null
          entity_id: string | null
          entity_type: string | null
          escalated_at: string | null
          href: string
          id: string
          investor_id: string | null
          metadata: Json
          priority: string
          reason: string | null
          role: string
          snoozed_until: string | null
          source_event_id: string | null
          source_module: string
          source_signature: string
          spv_id: string | null
          status: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          blockers?: Json
          category: string
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          dedupe_key: string
          description?: string
          dismissed_at?: string | null
          due_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          escalated_at?: string | null
          href: string
          id?: string
          investor_id?: string | null
          metadata?: Json
          priority: string
          reason?: string | null
          role: string
          snoozed_until?: string | null
          source_event_id?: string | null
          source_module: string
          source_signature?: string
          spv_id?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          blockers?: Json
          category?: string
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          dedupe_key?: string
          description?: string
          dismissed_at?: string | null
          due_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          escalated_at?: string | null
          href?: string
          id?: string
          investor_id?: string | null
          metadata?: Json
          priority?: string
          reason?: string | null
          role?: string
          snoozed_until?: string | null
          source_event_id?: string | null
          source_module?: string
          source_signature?: string
          spv_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "next_best_actions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_best_actions_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_best_actions_spv_id_fkey"
            columns: ["spv_id"]
            isOneToOne: false
            referencedRelation: "spv_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "next_best_actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          channel_email: boolean
          channel_in_app: boolean
          channel_slack: boolean
          critical_override: boolean
          digest_frequency: string
          events: Json
          pause_all: boolean
          quiet_end: string | null
          quiet_start: string | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channel_email?: boolean
          channel_in_app?: boolean
          channel_slack?: boolean
          critical_override?: boolean
          digest_frequency?: string
          events?: Json
          pause_all?: boolean
          quiet_end?: string | null
          quiet_start?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channel_email?: boolean
          channel_in_app?: boolean
          channel_slack?: boolean
          critical_override?: boolean
          digest_frequency?: string
          events?: Json
          pause_all?: boolean
          quiet_end?: string | null
          quiet_start?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_id: string | null
          actor_user_id: string | null
          archived_at: string | null
          created_at: string
          dedupe_key: string | null
          deep_link: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          message: string
          orchestration_type: string | null
          recipient_user_id: string
          severity: string | null
          title: string
          type: string
        }
        Insert: {
          action_id?: string | null
          actor_user_id?: string | null
          archived_at?: string | null
          created_at?: string
          dedupe_key?: string | null
          deep_link?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message: string
          orchestration_type?: string | null
          recipient_user_id: string
          severity?: string | null
          title: string
          type: string
        }
        Update: {
          action_id?: string | null
          actor_user_id?: string | null
          archived_at?: string | null
          created_at?: string
          dedupe_key?: string | null
          deep_link?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message?: string
          orchestration_type?: string | null
          recipient_user_id?: string
          severity?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "next_best_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_activity_events: {
        Row: {
          activity_audience: string | null
          activity_stage: string | null
          actor_role: string | null
          actor_user_id: string | null
          company_id: string | null
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string
          event_category: string
          event_type: string
          id: string
          investor_id: string | null
          metadata: Json
          related_user_id: string | null
          severity: string
          source_module: string
          spv_id: string | null
          title: string
          visibility: string
        }
        Insert: {
          activity_audience?: string | null
          activity_stage?: string | null
          actor_role?: string | null
          actor_user_id?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type: string
          event_category: string
          event_type: string
          id?: string
          investor_id?: string | null
          metadata?: Json
          related_user_id?: string | null
          severity?: string
          source_module: string
          spv_id?: string | null
          title: string
          visibility?: string
        }
        Update: {
          activity_audience?: string | null
          activity_stage?: string | null
          actor_role?: string | null
          actor_user_id?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string
          event_category?: string
          event_type?: string
          id?: string
          investor_id?: string | null
          metadata?: Json
          related_user_id?: string | null
          severity?: string
          source_module?: string
          spv_id?: string | null
          title?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_activity_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_activity_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_activity_events_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_activity_events_related_user_id_fkey"
            columns: ["related_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_activity_events_spv_id_fkey"
            columns: ["spv_id"]
            isOneToOne: false
            referencedRelation: "spv_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_advisory_actions: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          snooze_until: string | null
          suggestion_key: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          snooze_until?: string | null
          suggestion_key: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          snooze_until?: string | null
          suggestion_key?: string
        }
        Relationships: []
      }
      ops_hub_settings: {
        Row: {
          advisory_enabled: boolean
          drift_auto_add: boolean
          drift_detection: boolean
          drift_ignored: string[]
          escalation_past_due_days: number
          id: number
          playbook_edit_scope: string
          run_reset_tz: string
          updated_at: string
        }
        Insert: {
          advisory_enabled?: boolean
          drift_auto_add?: boolean
          drift_detection?: boolean
          drift_ignored?: string[]
          escalation_past_due_days?: number
          id?: number
          playbook_edit_scope?: string
          run_reset_tz?: string
          updated_at?: string
        }
        Update: {
          advisory_enabled?: boolean
          drift_auto_add?: boolean
          drift_detection?: boolean
          drift_ignored?: string[]
          escalation_past_due_days?: number
          id?: number
          playbook_edit_scope?: string
          run_reset_tz?: string
          updated_at?: string
        }
        Relationships: []
      }
      ops_settings: {
        Row: {
          default_manager_id: string | null
          diligence_sla_days: number
          email_escalations: boolean
          id: string
          onboarding_sla_days: number
          updated_at: string
        }
        Insert: {
          default_manager_id?: string | null
          diligence_sla_days?: number
          email_escalations?: boolean
          id?: string
          onboarding_sla_days?: number
          updated_at?: string
        }
        Update: {
          default_manager_id?: string | null
          diligence_sla_days?: number
          email_escalations?: boolean
          id?: string
          onboarding_sla_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ops_settings_default_manager_id_fkey"
            columns: ["default_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_tasks: {
        Row: {
          archived: boolean
          assignee_id: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          entity_id: string
          entity_type: string
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          entity_id: string
          entity_type: string
          id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ops_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ops_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orchestration_runs: {
        Row: {
          completed_at: string | null
          digests_generated: number
          duration_ms: number | null
          escalations_detected: number
          failures_count: number
          id: string
          metadata: Json
          overdue_detected: number
          reminders_generated: number
          started_at: string
          status: string
          trigger_source: string
        }
        Insert: {
          completed_at?: string | null
          digests_generated?: number
          duration_ms?: number | null
          escalations_detected?: number
          failures_count?: number
          id?: string
          metadata?: Json
          overdue_detected?: number
          reminders_generated?: number
          started_at?: string
          status?: string
          trigger_source?: string
        }
        Update: {
          completed_at?: string | null
          digests_generated?: number
          duration_ms?: number | null
          escalations_detected?: number
          failures_count?: number
          id?: string
          metadata?: Json
          overdue_detected?: number
          reminders_generated?: number
          started_at?: string
          status?: string
          trigger_source?: string
        }
        Relationships: []
      }
      org_billing_profile: {
        Row: {
          address: string | null
          billing_contact: string | null
          company: string | null
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          billing_contact?: string | null
          company?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          billing_contact?: string | null
          company?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_billing_profile_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_status: string
          can_add_companies: boolean
          created_at: string
          created_by: string | null
          created_via: string
          email_dispatch_enabled: boolean
          id: string
          name: string
          parent_org_id: string | null
          purpose: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string | null
          type: Database["public"]["Enums"]["org_type"]
        }
        Insert: {
          billing_status?: string
          can_add_companies?: boolean
          created_at?: string
          created_by?: string | null
          created_via?: string
          email_dispatch_enabled?: boolean
          id?: string
          name: string
          parent_org_id?: string | null
          purpose?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string | null
          type?: Database["public"]["Enums"]["org_type"]
        }
        Update: {
          billing_status?: string
          can_add_companies?: boolean
          created_at?: string
          created_by?: string | null
          created_via?: string
          email_dispatch_enabled?: boolean
          id?: string
          name?: string
          parent_org_id?: string | null
          purpose?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string | null
          type?: Database["public"]["Enums"]["org_type"]
        }
        Relationships: [
          {
            foreignKeyName: "organizations_parent_org_id_fkey"
            columns: ["parent_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_event_subscriptions: {
        Row: {
          connection_id: string
          created_at: string
          enabled: boolean
          event_type: string
          id: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          enabled?: boolean
          event_type: string
          id?: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          enabled?: boolean
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_event_subscriptions_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_campaigns: {
        Row: {
          audience_count: number
          company_id: string
          created_at: string
          daily_limit: number
          founder_id: string
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          audience_count?: number
          company_id: string
          created_at?: string
          daily_limit?: number
          founder_id: string
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          audience_count?: number
          company_id?: string
          created_at?: string
          daily_limit?: number
          founder_id?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_campaigns_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_messages: {
        Row: {
          body: string
          campaign_id: string
          contact_id: string
          created_at: string
          id: string
          opened_at: string | null
          replied_at: string | null
          scheduled_at: string | null
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          body: string
          campaign_id: string
          contact_id: string
          created_at?: string
          id?: string
          opened_at?: string | null
          replied_at?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          body?: string
          campaign_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          opened_at?: string | null
          replied_at?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "outreach_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "founder_investor_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_touches: {
        Row: {
          campaign_id: string | null
          channel: string
          contact_id: string
          direction: string
          id: string
          logged_by: string | null
          occurred_at: string
          summary: string | null
        }
        Insert: {
          campaign_id?: string | null
          channel: string
          contact_id: string
          direction?: string
          id?: string
          logged_by?: string | null
          occurred_at?: string
          summary?: string | null
        }
        Update: {
          campaign_id?: string | null
          channel?: string
          contact_id?: string
          direction?: string
          id?: string
          logged_by?: string | null
          occurred_at?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_touches_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "voice_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_touches_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      page_builder_drafts: {
        Row: {
          created_at: string
          id: string
          layout: Json
          page_slug: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          layout?: Json
          page_slug: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          layout?: Json
          page_slug?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_builder_drafts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      page_builder_snapshots: {
        Row: {
          created_at: string
          created_by: string | null
          draft_id: string
          id: string
          label: string | null
          layout: Json
          page_slug: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          draft_id: string
          id?: string
          label?: string | null
          layout: Json
          page_slug: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          draft_id?: string
          id?: string
          label?: string | null
          layout?: Json
          page_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_builder_snapshots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_builder_snapshots_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "page_builder_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          crm_contact_id: string | null
          id: string
          is_active: boolean
          partner_name: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          crm_contact_id?: string | null
          id?: string
          is_active?: boolean
          partner_name: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          crm_contact_id?: string | null
          id?: string
          is_active?: boolean
          partner_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_codes_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "contact_sides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_codes_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_codes_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "hot_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_codes_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "lead_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_codes_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "match_campaign_founder_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_score_snapshots: {
        Row: {
          computed_at: string
          investor_id: string
          payload: Json
          sample_size: number
          score: number | null
          status: string
          tier: string
        }
        Insert: {
          computed_at?: string
          investor_id: string
          payload: Json
          sample_size?: number
          score?: number | null
          status: string
          tier: string
        }
        Update: {
          computed_at?: string
          investor_id?: string
          payload?: Json
          sample_size?: number
          score?: number | null
          status?: string
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_score_snapshots_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_score_weights: {
        Row: {
          id: string
          updated_at: string
          updated_by: string | null
          weights: Json
        }
        Insert: {
          id?: string
          updated_at?: string
          updated_by?: string | null
          weights: Json
        }
        Update: {
          id?: string
          updated_at?: string
          updated_by?: string | null
          weights?: Json
        }
        Relationships: [
          {
            foreignKeyName: "partner_score_weights_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_investor_notes: {
        Row: {
          body: string
          created_at: string
          founder_id: string
          id: string
          pipeline_investor_id: string
        }
        Insert: {
          body: string
          created_at?: string
          founder_id: string
          id?: string
          pipeline_investor_id: string
        }
        Update: {
          body?: string
          created_at?: string
          founder_id?: string
          id?: string
          pipeline_investor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_investor_notes_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_investor_notes_pipeline_investor_id_fkey"
            columns: ["pipeline_investor_id"]
            isOneToOne: false
            referencedRelation: "pipeline_investors"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_investors: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          focus_sectors: string[] | null
          founder_id: string
          id: string
          interested: boolean
          investment_size: string | null
          investor_type: string
          last_contact_date: string | null
          location: string | null
          match_score: number | null
          meeting_requested: string
          name: string
          next_follow_up_date: string | null
          notes: string | null
          org_id: string | null
          outreach_status: string
          pipeline_stage: string
          platform_investor_id: string | null
          pledge_amount: number | null
          preferred_stages: string[] | null
          source: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          focus_sectors?: string[] | null
          founder_id: string
          id?: string
          interested?: boolean
          investment_size?: string | null
          investor_type?: string
          last_contact_date?: string | null
          location?: string | null
          match_score?: number | null
          meeting_requested?: string
          name: string
          next_follow_up_date?: string | null
          notes?: string | null
          org_id?: string | null
          outreach_status?: string
          pipeline_stage?: string
          platform_investor_id?: string | null
          pledge_amount?: number | null
          preferred_stages?: string[] | null
          source?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          focus_sectors?: string[] | null
          founder_id?: string
          id?: string
          interested?: boolean
          investment_size?: string | null
          investor_type?: string
          last_contact_date?: string | null
          location?: string | null
          match_score?: number | null
          meeting_requested?: string
          name?: string
          next_follow_up_date?: string | null
          notes?: string | null
          org_id?: string | null
          outreach_status?: string
          pipeline_stage?: string
          platform_investor_id?: string | null
          pledge_amount?: number | null
          preferred_stages?: string[] | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_investors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_deck_analyses: {
        Row: {
          analysis: Json
          company_id: string
          org_id: string | null
          updated_at: string
        }
        Insert: {
          analysis: Json
          company_id: string
          org_id?: string | null
          updated_at?: string
        }
        Update: {
          analysis?: Json
          company_id?: string
          org_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pitch_deck_analyses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitch_deck_analyses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_decks: {
        Row: {
          ai_assisted: boolean
          company_id: string
          created_at: string
          finalized_at: string | null
          generated_at: string | null
          id: string
          last_edited_by: string | null
          org_id: string | null
          share_token: string | null
          slides: Json
          status: string
          theme: string
          updated_at: string
        }
        Insert: {
          ai_assisted?: boolean
          company_id: string
          created_at?: string
          finalized_at?: string | null
          generated_at?: string | null
          id?: string
          last_edited_by?: string | null
          org_id?: string | null
          share_token?: string | null
          slides?: Json
          status?: string
          theme?: string
          updated_at?: string
        }
        Update: {
          ai_assisted?: boolean
          company_id?: string
          created_at?: string
          finalized_at?: string | null
          generated_at?: string | null
          id?: string
          last_edited_by?: string | null
          org_id?: string | null
          share_token?: string | null
          slides?: Json
          status?: string
          theme?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pitch_decks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitch_decks_last_edited_by_fkey"
            columns: ["last_edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitch_decks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          cohort_label: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          last_sent_at: string | null
          learning_program_id: string | null
          metadata: Json
          requested_plan: string | null
          revoked_at: string | null
          revoked_by: string | null
          role: string
          send_count: number
          status: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          cohort_label?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          last_sent_at?: string | null
          learning_program_id?: string | null
          metadata?: Json
          requested_plan?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role: string
          send_count?: number
          status?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          cohort_label?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          last_sent_at?: string | null
          learning_program_id?: string | null
          metadata?: Json
          requested_plan?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          role?: string
          send_count?: number
          status?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_invites_learning_program_id_fkey"
            columns: ["learning_program_id"]
            isOneToOne: false
            referencedRelation: "learning_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_invites_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      playbook_daily_checks: {
        Row: {
          admin_id: string
          checked_at: string
          checked_on: string
          id: string
          surface_id: string
        }
        Insert: {
          admin_id: string
          checked_at?: string
          checked_on: string
          id?: string
          surface_id: string
        }
        Update: {
          admin_id?: string
          checked_at?: string
          checked_on?: string
          id?: string
          surface_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_daily_checks_surface_id_fkey"
            columns: ["surface_id"]
            isOneToOne: false
            referencedRelation: "playbook_module"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_flag: {
        Row: {
          id: string
          kind: string
          label: string
          module_id: string
        }
        Insert: {
          id?: string
          kind: string
          label: string
          module_id: string
        }
        Update: {
          id?: string
          kind?: string
          label?: string
          module_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_flag_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "playbook_module"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_module: {
        Row: {
          block: string
          cadence: string
          count_source: string | null
          id: string
          nav_id: string
          role_note: string | null
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          block: string
          cadence?: string
          count_source?: string | null
          id?: string
          nav_id: string
          role_note?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          block?: string
          cadence?: string
          count_source?: string | null
          id?: string
          nav_id?: string
          role_note?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      playbook_step: {
        Row: {
          body: string
          id: string
          module_id: string
          step_no: number
        }
        Insert: {
          body: string
          id?: string
          module_id: string
          step_no: number
        }
        Update: {
          body?: string
          id?: string
          module_id?: string
          step_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "playbook_step_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "playbook_module"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_investments: {
        Row: {
          amount_invested: number
          company_id: string | null
          company_name: string
          company_slug: string | null
          created_at: string
          current_valuation: number | null
          deal_room_id: string | null
          entry_valuation: number | null
          id: string
          interest_id: string | null
          invested_at: string
          investor_user_id: string
          notes: string | null
          sector: string | null
          source: string
          stage: string | null
          status: string
          updated_at: string
          val_updated_at: string | null
        }
        Insert: {
          amount_invested: number
          company_id?: string | null
          company_name: string
          company_slug?: string | null
          created_at?: string
          current_valuation?: number | null
          deal_room_id?: string | null
          entry_valuation?: number | null
          id?: string
          interest_id?: string | null
          invested_at: string
          investor_user_id: string
          notes?: string | null
          sector?: string | null
          source?: string
          stage?: string | null
          status?: string
          updated_at?: string
          val_updated_at?: string | null
        }
        Update: {
          amount_invested?: number
          company_id?: string | null
          company_name?: string
          company_slug?: string | null
          created_at?: string
          current_valuation?: number | null
          deal_room_id?: string | null
          entry_valuation?: number | null
          id?: string
          interest_id?: string | null
          invested_at?: string
          investor_user_id?: string
          notes?: string | null
          sector?: string | null
          source?: string
          stage?: string | null
          status?: string
          updated_at?: string
          val_updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_investments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_investments_deal_room_id_fkey"
            columns: ["deal_room_id"]
            isOneToOne: false
            referencedRelation: "deal_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_sets: {
        Row: {
          add_company_cents: number
          created_at: string
          created_by: string | null
          effective_at: string
          existing_policy: string
          id: string
          is_active: boolean
          plans: Json
          reason: string | null
          version: string
        }
        Insert: {
          add_company_cents?: number
          created_at?: string
          created_by?: string | null
          effective_at?: string
          existing_policy?: string
          id?: string
          is_active?: boolean
          plans: Json
          reason?: string | null
          version: string
        }
        Update: {
          add_company_cents?: number
          created_at?: string
          created_by?: string | null
          effective_at?: string
          existing_policy?: string
          id?: string
          is_active?: boolean
          plans?: Json
          reason?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_sets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_stripe_events: {
        Row: {
          event_id: string
          processed_at: string
        }
        Insert: {
          event_id: string
          processed_at?: string
        }
        Update: {
          event_id?: string
          processed_at?: string
        }
        Relationships: []
      }
      profile_field_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          list: string
          note: string | null
          snapshot: Json
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          list: string
          note?: string | null
          snapshot: Json
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          list?: string
          note?: string | null
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "profile_field_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_view_log: {
        Row: {
          company_id: string
          id: number
          match_id: string | null
          surface: string
          viewed_at: string
          viewer_user_id: string
        }
        Insert: {
          company_id: string
          id?: never
          match_id?: string | null
          surface: string
          viewed_at?: string
          viewer_user_id: string
        }
        Update: {
          company_id?: string
          id?: never
          match_id?: string | null
          surface?: string
          viewed_at?: string
          viewer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_view_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_view_log_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "investor_founder_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          deletion_requested_at: string | null
          deletion_scheduled_for: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          invite_cohort_label: string | null
          is_active: boolean
          is_super_admin: boolean
          journey_stage: string
          journey_stage_updated_at: string | null
          last_seen_at: string | null
          learning_program_id: string | null
          locale: string
          role: string | null
          stage_approval_requested_at: string | null
          stage_approval_status: string | null
          stage_approved_at: string | null
          stage_approved_by: string | null
          stage_feedback: string | null
        }
        Insert: {
          avatar_url?: string | null
          deletion_requested_at?: string | null
          deletion_scheduled_for?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          invite_cohort_label?: string | null
          is_active?: boolean
          is_super_admin?: boolean
          journey_stage?: string
          journey_stage_updated_at?: string | null
          last_seen_at?: string | null
          learning_program_id?: string | null
          locale?: string
          role?: string | null
          stage_approval_requested_at?: string | null
          stage_approval_status?: string | null
          stage_approved_at?: string | null
          stage_approved_by?: string | null
          stage_feedback?: string | null
        }
        Update: {
          avatar_url?: string | null
          deletion_requested_at?: string | null
          deletion_scheduled_for?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          invite_cohort_label?: string | null
          is_active?: boolean
          is_super_admin?: boolean
          journey_stage?: string
          journey_stage_updated_at?: string | null
          last_seen_at?: string | null
          learning_program_id?: string | null
          locale?: string
          role?: string | null
          stage_approval_requested_at?: string | null
          stage_approval_status?: string | null
          stage_approved_at?: string | null
          stage_approved_by?: string | null
          stage_feedback?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_learning_program_id_fkey"
            columns: ["learning_program_id"]
            isOneToOne: false
            referencedRelation: "learning_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_stage_approved_by_fkey"
            columns: ["stage_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_intro_requests: {
        Row: {
          company_id: string
          created_at: string
          founder_id: string
          handled_at: string | null
          handled_by: string | null
          id: string
          investor_ref: string
          note: string | null
          org_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          founder_id: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          investor_ref: string
          note?: string | null
          org_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          founder_id?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          investor_ref?: string
          note?: string | null
          org_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_intro_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_intro_requests_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_intro_requests_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_intro_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_investors: {
        Row: {
          active_rating: number | null
          activity_band: string | null
          capital_types: string[]
          check_size_max: number | null
          check_size_min: number | null
          created_at: string
          created_by: string | null
          domain: string | null
          firm_stem: string | null
          id: string
          investor_type: string | null
          lawful_basis: string | null
          name: string
          notes: string | null
          preferred_geographies: string[]
          preferred_sectors: string[]
          preferred_stages: string[]
          segment: string
          source: string | null
          source_ref: string | null
          state_or_country: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          active_rating?: number | null
          activity_band?: string | null
          capital_types?: string[]
          check_size_max?: number | null
          check_size_min?: number | null
          created_at?: string
          created_by?: string | null
          domain?: string | null
          firm_stem?: string | null
          id?: string
          investor_type?: string | null
          lawful_basis?: string | null
          name: string
          notes?: string | null
          preferred_geographies?: string[]
          preferred_sectors?: string[]
          preferred_stages?: string[]
          segment?: string
          source?: string | null
          source_ref?: string | null
          state_or_country?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          active_rating?: number | null
          activity_band?: string | null
          capital_types?: string[]
          check_size_max?: number | null
          check_size_min?: number | null
          created_at?: string
          created_by?: string | null
          domain?: string | null
          firm_stem?: string | null
          id?: string
          investor_type?: string | null
          lawful_basis?: string | null
          name?: string
          notes?: string | null
          preferred_geographies?: string[]
          preferred_sectors?: string[]
          preferred_stages?: string[]
          segment?: string
          source?: string | null
          source_ref?: string | null
          state_or_country?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      publish_events: {
        Row: {
          contact_id: string | null
          email: string | null
          event: string | null
          id: string
          occurred_at: string
          publish_id: string | null
          resend_id: string | null
        }
        Insert: {
          contact_id?: string | null
          email?: string | null
          event?: string | null
          id?: string
          occurred_at?: string
          publish_id?: string | null
          resend_id?: string | null
        }
        Update: {
          contact_id?: string | null
          email?: string | null
          event?: string | null
          id?: string
          occurred_at?: string
          publish_id?: string | null
          resend_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publish_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contact_sides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publish_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publish_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "hot_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publish_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "lead_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publish_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "match_campaign_founder_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publish_events_publish_id_fkey"
            columns: ["publish_id"]
            isOneToOne: false
            referencedRelation: "publish_items"
            referencedColumns: ["id"]
          },
        ]
      }
      publish_items: {
        Row: {
          approved_by: string | null
          batch: number | null
          body: Json
          channel: string
          created_at: string
          created_by: string | null
          id: string
          lint_result: Json
          scheduled_for: string | null
          segment: string | null
          sent_at: string | null
          status: string
          title: string
          wave: string | null
        }
        Insert: {
          approved_by?: string | null
          batch?: number | null
          body: Json
          channel: string
          created_at?: string
          created_by?: string | null
          id?: string
          lint_result?: Json
          scheduled_for?: string | null
          segment?: string | null
          sent_at?: string | null
          status?: string
          title: string
          wave?: string | null
        }
        Update: {
          approved_by?: string | null
          batch?: number | null
          body?: Json
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lint_result?: Json
          scheduled_for?: string | null
          segment?: string | null
          sent_at?: string | null
          status?: string
          title?: string
          wave?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publish_items_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publish_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      raise_toolkit_sessions: {
        Row: {
          company_id: string
          data: Json
          founder_id: string
          id: string
          tool_key: string
          updated_at: string
        }
        Insert: {
          company_id: string
          data?: Json
          founder_id: string
          id?: string
          tool_key: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          data?: Json
          founder_id?: string
          id?: string
          tool_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "raise_toolkit_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      regcf_documents: {
        Row: {
          ai_generated: boolean
          company_id: string | null
          content: string | null
          created_at: string
          doc_key: string
          founder_id: string
          id: string
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean
          company_id?: string | null
          content?: string | null
          created_at?: string
          doc_key: string
          founder_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean
          company_id?: string | null
          content?: string | null
          created_at?: string
          doc_key?: string
          founder_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regcf_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regcf_documents_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_field_sets: {
        Row: {
          by_type: Json
          common: Json
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          reason: string | null
          roles: Json
          version: string
        }
        Insert: {
          by_type: Json
          common: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          reason?: string | null
          roles: Json
          version: string
        }
        Update: {
          by_type?: Json
          common?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          reason?: string | null
          roles?: Json
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_field_sets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          answers: Json
          attendee_id: string | null
          attendee_type: string | null
          checked_in_at: string | null
          created_at: string
          event_id: string
          id: string
          invitation_id: string | null
          registered_by: string
          source: string
          status: Database["public"]["Enums"]["registration_status"]
        }
        Insert: {
          answers?: Json
          attendee_id?: string | null
          attendee_type?: string | null
          checked_in_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          invitation_id?: string | null
          registered_by?: string
          source?: string
          status?: Database["public"]["Enums"]["registration_status"]
        }
        Update: {
          answers?: Json
          attendee_id?: string | null
          attendee_type?: string | null
          checked_in_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          invitation_id?: string | null
          registered_by?: string
          source?: string
          status?: Database["public"]["Enums"]["registration_status"]
        }
        Relationships: [
          {
            foreignKeyName: "registrations_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "event_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_activity_log: {
        Row: {
          actor_id: string | null
          contact_crm_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          edited_at: string | null
          edited_by: string | null
          id: string
          kind: string
          meta: Json | null
          odoo_message_id: number | null
          opportunity_id: string | null
          summary: string
        }
        Insert: {
          actor_id?: string | null
          contact_crm_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string | null
          edited_by?: string | null
          id?: string
          kind: string
          meta?: Json | null
          odoo_message_id?: number | null
          opportunity_id?: string | null
          summary: string
        }
        Update: {
          actor_id?: string | null
          contact_crm_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          edited_at?: string | null
          edited_by?: string | null
          id?: string
          kind?: string
          meta?: Json | null
          odoo_message_id?: number | null
          opportunity_id?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_activity_log_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_activity_log_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_activity_log_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "sales_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_ai_insights: {
        Row: {
          created_by: string | null
          drivers: Json
          generated_at: string
          id: string
          input_hash: string
          metric_key: string
          model: string | null
          narrative: string
          snapshot_id: string | null
          suggested_actions: Json
        }
        Insert: {
          created_by?: string | null
          drivers?: Json
          generated_at?: string
          id?: string
          input_hash: string
          metric_key: string
          model?: string | null
          narrative: string
          snapshot_id?: string | null
          suggested_actions?: Json
        }
        Update: {
          created_by?: string | null
          drivers?: Json
          generated_at?: string
          id?: string
          input_hash?: string
          metric_key?: string
          model?: string | null
          narrative?: string
          snapshot_id?: string | null
          suggested_actions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sales_ai_insights_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_ai_insights_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "sales_forecast_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_analytics_insights: {
        Row: {
          created_by: string | null
          drivers: Json
          generated_at: string
          id: string
          input_hash: string
          metric_key: string
          model: string | null
          narrative: string
          suggested_actions: Json
        }
        Insert: {
          created_by?: string | null
          drivers?: Json
          generated_at?: string
          id?: string
          input_hash: string
          metric_key: string
          model?: string | null
          narrative: string
          suggested_actions?: Json
        }
        Update: {
          created_by?: string | null
          drivers?: Json
          generated_at?: string
          id?: string
          input_hash?: string
          metric_key?: string
          model?: string | null
          narrative?: string
          suggested_actions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sales_analytics_insights_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_bulk_assign_audit: {
        Row: {
          actor_id: string | null
          contact_count: number
          created_at: string
          filter: string | null
          id: number
          member_ids: string[]
        }
        Insert: {
          actor_id?: string | null
          contact_count?: number
          created_at?: string
          filter?: string | null
          id?: never
          member_ids?: string[]
        }
        Update: {
          actor_id?: string | null
          contact_count?: number
          created_at?: string
          filter?: string | null
          id?: never
          member_ids?: string[]
        }
        Relationships: []
      }
      sales_forecast_assumptions: {
        Row: {
          driver_key: string
          id: string
          month_from: number
          month_to: number
          scenario_id: string
          segment: string | null
          updated_at: string
          updated_by: string | null
          value: number
        }
        Insert: {
          driver_key: string
          id?: string
          month_from?: number
          month_to?: number
          scenario_id: string
          segment?: string | null
          updated_at?: string
          updated_by?: string | null
          value: number
        }
        Update: {
          driver_key?: string
          id?: string
          month_from?: number
          month_to?: number
          scenario_id?: string
          segment?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_forecast_assumptions_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "sales_forecast_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_forecast_assumptions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_forecast_pipeline_weights: {
        Row: {
          expected_lag_days: number
          id: string
          is_active: boolean
          stage_id: string
          updated_at: string
          updated_by: string | null
          win_probability: number
        }
        Insert: {
          expected_lag_days?: number
          id?: string
          is_active?: boolean
          stage_id: string
          updated_at?: string
          updated_by?: string | null
          win_probability?: number
        }
        Update: {
          expected_lag_days?: number
          id?: string
          is_active?: boolean
          stage_id?: string
          updated_at?: string
          updated_by?: string | null
          win_probability?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_forecast_pipeline_weights_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: true
            referencedRelation: "sales_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_forecast_pipeline_weights_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_forecast_scenarios: {
        Row: {
          created_at: string
          created_by: string | null
          horizon_months: number
          id: string
          is_active: boolean
          kind: string
          name: string
          notes: string | null
          start_month: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          horizon_months?: number
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          notes?: string | null
          start_month?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          horizon_months?: number
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          notes?: string | null
          start_month?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_forecast_scenarios_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_forecast_snapshots: {
        Row: {
          assumptions_hash: string
          computed_at: string
          created_by: string | null
          engine_version: string
          id: string
          output: Json
          owner_id: string | null
          scenario_id: string
        }
        Insert: {
          assumptions_hash: string
          computed_at?: string
          created_by?: string | null
          engine_version: string
          id?: string
          output: Json
          owner_id?: string | null
          scenario_id: string
        }
        Update: {
          assumptions_hash?: string
          computed_at?: string
          created_by?: string | null
          engine_version?: string
          id?: string
          output?: Json
          owner_id?: string | null
          scenario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_forecast_snapshots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_forecast_snapshots_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_forecast_snapshots_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "sales_forecast_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_forecast_targets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          metric_key: string
          month: number
          segment: string | null
          target_value: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          metric_key: string
          month: number
          segment?: string | null
          target_value: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          metric_key?: string
          month?: number
          segment?: string | null
          target_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_forecast_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_journal_entries: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          deal_ref: string | null
          entry_type: string
          id: string
          pinned: boolean
          revision_of: string | null
          snapshot_ref: string | null
          tags: string[]
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          deal_ref?: string | null
          entry_type: string
          id?: string
          pinned?: boolean
          revision_of?: string | null
          snapshot_ref?: string | null
          tags?: string[]
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          deal_ref?: string | null
          entry_type?: string
          id?: string
          pinned?: boolean
          revision_of?: string | null
          snapshot_ref?: string | null
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "sales_journal_entries_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_journal_entries_revision_of_fkey"
            columns: ["revision_of"]
            isOneToOne: false
            referencedRelation: "sales_journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_journal_entries_snapshot_ref_fkey"
            columns: ["snapshot_ref"]
            isOneToOne: false
            referencedRelation: "sales_forecast_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_opportunities: {
        Row: {
          billing: string
          company_id: string | null
          contact_crm_id: string | null
          contact_email: string | null
          contact_name: string | null
          contact_profile_id: string | null
          created_at: string
          created_by: string | null
          expected_close: string | null
          external_id: string | null
          external_source: string | null
          id: string
          last_activity_at: string | null
          lead_status: string | null
          notes: string | null
          odoo_lead_id: string | null
          owner_id: string | null
          pipeline_id: string | null
          priority: number
          probability: number | null
          source: string | null
          stage_id: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string
          value_cents: number | null
        }
        Insert: {
          billing?: string
          company_id?: string | null
          contact_crm_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_profile_id?: string | null
          created_at?: string
          created_by?: string | null
          expected_close?: string | null
          external_id?: string | null
          external_source?: string | null
          id?: string
          last_activity_at?: string | null
          lead_status?: string | null
          notes?: string | null
          odoo_lead_id?: string | null
          owner_id?: string | null
          pipeline_id?: string | null
          priority?: number
          probability?: number | null
          source?: string | null
          stage_id?: string | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          value_cents?: number | null
        }
        Update: {
          billing?: string
          company_id?: string | null
          contact_crm_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_profile_id?: string | null
          created_at?: string
          created_by?: string | null
          expected_close?: string | null
          external_id?: string | null
          external_source?: string | null
          id?: string
          last_activity_at?: string | null
          lead_status?: string | null
          notes?: string | null
          odoo_lead_id?: string | null
          owner_id?: string | null
          pipeline_id?: string | null
          priority?: number
          probability?: number | null
          source?: string | null
          stage_id?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          value_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_opportunities_contact_profile_id_fkey"
            columns: ["contact_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_opportunities_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_opportunities_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "sales_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_opportunities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "sales_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_pipelines: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          is_default: boolean
          name: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
        }
        Relationships: []
      }
      sales_settings: {
        Row: {
          default_assignee_id: string | null
          id: string
          lead_assignee_ids: string[]
          remind_close_passed: boolean
          remind_stalled: boolean
          remind_task_due: boolean
          stalled_days: number
          task_types: string[]
          updated_at: string
        }
        Insert: {
          default_assignee_id?: string | null
          id?: string
          lead_assignee_ids?: string[]
          remind_close_passed?: boolean
          remind_stalled?: boolean
          remind_task_due?: boolean
          stalled_days?: number
          task_types?: string[]
          updated_at?: string
        }
        Update: {
          default_assignee_id?: string | null
          id?: string
          lead_assignee_ids?: string[]
          remind_close_passed?: boolean
          remind_stalled?: boolean
          remind_task_due?: boolean
          stalled_days?: number
          task_types?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_settings_default_assignee_id_fkey"
            columns: ["default_assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_stages: {
        Row: {
          created_at: string
          id: string
          is_won: boolean
          name: string
          pipeline_id: string
          sequence_id: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_won?: boolean
          name: string
          pipeline_id: string
          sequence_id?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_won?: boolean
          name?: string
          pipeline_id?: string
          sequence_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "sales_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_stages_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "marketing_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_task_title_options: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          sort_order: number
          task_type: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          sort_order?: number
          task_type?: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          sort_order?: number
          task_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_task_title_options_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_tasks: {
        Row: {
          assignee_id: string | null
          contact_crm_id: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          done_at: string | null
          due_date: string | null
          id: string
          opportunity_id: string | null
          source_kind: string
          source_ref: string | null
          status: string
          summary: string | null
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          contact_crm_id?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          due_date?: string | null
          id?: string
          opportunity_id?: string | null
          source_kind?: string
          source_ref?: string | null
          status?: string
          summary?: string | null
          task_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          contact_crm_id?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          due_date?: string | null
          id?: string
          opportunity_id?: string | null
          source_kind?: string
          source_ref?: string | null
          status?: string
          summary?: string | null
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tasks_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "sales_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_deals: {
        Row: {
          campaign_id: string | null
          company_id: string
          created_at: string
          id: string
          investor_id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          investor_id: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          investor_id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_deals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_deals_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_digest_items: {
        Row: {
          action_id: string | null
          deep_link: string | null
          id: string
          run_id: string
          section: string
          severity: string
          sort_order: number
          title: string
        }
        Insert: {
          action_id?: string | null
          deep_link?: string | null
          id?: string
          run_id: string
          section: string
          severity?: string
          sort_order?: number
          title: string
        }
        Update: {
          action_id?: string | null
          deep_link?: string | null
          id?: string
          run_id?: string
          section?: string
          severity?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_digest_items_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "next_best_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_digest_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "scheduled_digest_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_digest_runs: {
        Row: {
          delivery_status: string
          digest_type: string
          generated_at: string
          id: string
          item_count: number
          metadata: Json
          severity: string
          user_id: string | null
        }
        Insert: {
          delivery_status?: string
          digest_type: string
          generated_at?: string
          id?: string
          item_count?: number
          metadata?: Json
          severity?: string
          user_id?: string | null
        }
        Update: {
          delivery_status?: string
          digest_type?: string
          generated_at?: string
          id?: string
          item_count?: number
          metadata?: Json
          severity?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_digest_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_emails: {
        Row: {
          attempts: number
          context_key: string | null
          created_at: string
          created_by: string
          error: string | null
          id: string
          kind: string
          params: Json
          payload: Json
          result: Json | null
          send_at: string
          sent_at: string | null
          status: string
          subject: string
          to_label: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          context_key?: string | null
          created_at?: string
          created_by: string
          error?: string | null
          id?: string
          kind: string
          params?: Json
          payload: Json
          result?: Json | null
          send_at: string
          sent_at?: string | null
          status?: string
          subject?: string
          to_label?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          context_key?: string | null
          created_at?: string
          created_by?: string
          error?: string | null
          id?: string
          kind?: string
          params?: Json
          payload?: Json
          result?: Json | null
          send_at?: string
          sent_at?: string | null
          status?: string
          subject?: string
          to_label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_emails_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_reach_outs: {
        Row: {
          also_nudge: boolean
          body: string
          channel: string | null
          company_id: string
          created_at: string
          created_by: string
          error: string | null
          founder_id: string
          html: string
          id: string
          reply_to: string | null
          send_at: string
          sent_at: string | null
          status: string
          subject: string
          to_email: string
          updated_at: string
          via: string
        }
        Insert: {
          also_nudge?: boolean
          body: string
          channel?: string | null
          company_id: string
          created_at?: string
          created_by: string
          error?: string | null
          founder_id: string
          html: string
          id?: string
          reply_to?: string | null
          send_at: string
          sent_at?: string | null
          status?: string
          subject: string
          to_email: string
          updated_at?: string
          via: string
        }
        Update: {
          also_nudge?: boolean
          body?: string
          channel?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          error?: string | null
          founder_id?: string
          html?: string
          id?: string
          reply_to?: string | null
          send_at?: string
          sent_at?: string | null
          status?: string
          subject?: string
          to_email?: string
          updated_at?: string
          via?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_reach_outs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_reach_outs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_reach_outs_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduling_availability: {
        Row: {
          buffer_minutes: number
          contact_fields: Json | null
          created_at: string
          meeting_title: string | null
          profile_id: string
          questions: Json
          slot_durations: Json | null
          slot_minutes: number
          timezone: string
          updated_at: string
          weekly_rules: Json
        }
        Insert: {
          buffer_minutes?: number
          contact_fields?: Json | null
          created_at?: string
          meeting_title?: string | null
          profile_id: string
          questions?: Json
          slot_durations?: Json | null
          slot_minutes?: number
          timezone?: string
          updated_at?: string
          weekly_rules?: Json
        }
        Update: {
          buffer_minutes?: number
          contact_fields?: Json | null
          created_at?: string
          meeting_title?: string | null
          profile_id?: string
          questions?: Json
          slot_durations?: Json | null
          slot_minutes?: number
          timezone?: string
          updated_at?: string
          weekly_rules?: Json
        }
        Relationships: [
          {
            foreignKeyName: "scheduling_availability_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduling_bookings: {
        Row: {
          answers: Json
          booker_company: string | null
          booker_email: string | null
          booker_name: string | null
          booker_phone: string | null
          contact_crm_id: string | null
          created_at: string
          end_time: string
          event_id: string | null
          event_type: string | null
          host_id: string | null
          id: string
          meet_url: string | null
          note: string | null
          source_confidence: string | null
          source_set_at: string | null
          source_set_by: string | null
          source_tag: string | null
          start_time: string
          status: string
          timezone: string | null
        }
        Insert: {
          answers?: Json
          booker_company?: string | null
          booker_email?: string | null
          booker_name?: string | null
          booker_phone?: string | null
          contact_crm_id?: string | null
          created_at?: string
          end_time: string
          event_id?: string | null
          event_type?: string | null
          host_id?: string | null
          id?: string
          meet_url?: string | null
          note?: string | null
          source_confidence?: string | null
          source_set_at?: string | null
          source_set_by?: string | null
          source_tag?: string | null
          start_time: string
          status?: string
          timezone?: string | null
        }
        Update: {
          answers?: Json
          booker_company?: string | null
          booker_email?: string | null
          booker_name?: string | null
          booker_phone?: string | null
          contact_crm_id?: string | null
          created_at?: string
          end_time?: string
          event_id?: string | null
          event_type?: string | null
          host_id?: string | null
          id?: string
          meet_url?: string | null
          note?: string | null
          source_confidence?: string | null
          source_set_at?: string | null
          source_set_by?: string | null
          source_tag?: string | null
          start_time?: string
          status?: string
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduling_bookings_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduling_bookings_source_set_by_fkey"
            columns: ["source_set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sector_multiples: {
        Row: {
          arr_band: Database["public"]["Enums"]["valuation_arr_band"]
          as_of: string
          growth_band: string
          id: string
          multiple_high: number
          multiple_low: number
          sector: string
          source_name: string | null
          source_url: string | null
        }
        Insert: {
          arr_band: Database["public"]["Enums"]["valuation_arr_band"]
          as_of: string
          growth_band: string
          id?: string
          multiple_high: number
          multiple_low: number
          sector: string
          source_name?: string | null
          source_url?: string | null
        }
        Update: {
          arr_band?: Database["public"]["Enums"]["valuation_arr_band"]
          as_of?: string
          growth_band?: string
          id?: string
          multiple_high?: number
          multiple_low?: number
          sector?: string
          source_name?: string | null
          source_url?: string | null
        }
        Relationships: []
      }
      session_callin_queue: {
        Row: {
          created_at: string
          event_id: string
          id: string
          profile_id: string
          session_id: string
          status: Database["public"]["Enums"]["callin_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          profile_id: string
          session_id: string
          status?: Database["public"]["Enums"]["callin_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          profile_id?: string
          session_id?: string
          status?: Database["public"]["Enums"]["callin_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_callin_queue_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_callin_queue_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_callin_queue_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_chat_messages: {
        Row: {
          body: string
          created_at: string
          event_id: string
          id: string
          profile_id: string
          session_id: string
        }
        Insert: {
          body: string
          created_at?: string
          event_id: string
          id?: string
          profile_id: string
          session_id: string
        }
        Update: {
          body?: string
          created_at?: string
          event_id?: string
          id?: string
          profile_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_chat_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_chat_messages_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_guests: {
        Row: {
          created_at: string
          display_name: string
          event_id: string
          id: string
          position: number
          profile_id: string | null
          role_label: string | null
          session_id: string
          status: Database["public"]["Enums"]["guest_status"]
        }
        Insert: {
          created_at?: string
          display_name: string
          event_id: string
          id?: string
          position?: number
          profile_id?: string | null
          role_label?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["guest_status"]
        }
        Update: {
          created_at?: string
          display_name?: string
          event_id?: string
          id?: string
          position?: number
          profile_id?: string | null
          role_label?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["guest_status"]
        }
        Relationships: [
          {
            foreignKeyName: "session_guests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_guests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_guests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_question_votes: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          question_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          question_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          question_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_question_votes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_question_votes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "session_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_question_votes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_questions: {
        Row: {
          body: string
          created_at: string
          event_id: string
          id: string
          is_answered: boolean
          is_hidden: boolean
          profile_id: string
          session_id: string
        }
        Insert: {
          body: string
          created_at?: string
          event_id: string
          id?: string
          is_answered?: boolean
          is_hidden?: boolean
          profile_id: string
          session_id: string
        }
        Update: {
          body?: string
          created_at?: string
          event_id?: string
          id?: string
          is_answered?: boolean
          is_hidden?: boolean
          profile_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_questions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_questions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_segments: {
        Row: {
          created_at: string
          event_id: string
          id: string
          position: number
          session_id: string
          status: Database["public"]["Enums"]["segment_status"]
          title: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          position?: number
          session_id: string
          status?: Database["public"]["Enums"]["segment_status"]
          title: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          position?: number
          session_id?: string
          status?: Database["public"]["Enums"]["segment_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_segments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_segments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          abstract: string | null
          call_in_enabled: boolean
          chat_enabled: boolean
          created_at: string
          doors_open: boolean
          ends_at: string | null
          event_id: string
          host_sponsor_id: string | null
          id: string
          is_headline: boolean
          position: number
          recording_path: string | null
          sector_slug: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["session_status"]
          title: string
          type: Database["public"]["Enums"]["session_type"]
          updated_at: string
          video_provider: string | null
          video_ref: string | null
        }
        Insert: {
          abstract?: string | null
          call_in_enabled?: boolean
          chat_enabled?: boolean
          created_at?: string
          doors_open?: boolean
          ends_at?: string | null
          event_id: string
          host_sponsor_id?: string | null
          id?: string
          is_headline?: boolean
          position?: number
          recording_path?: string | null
          sector_slug?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          title: string
          type?: Database["public"]["Enums"]["session_type"]
          updated_at?: string
          video_provider?: string | null
          video_ref?: string | null
        }
        Update: {
          abstract?: string | null
          call_in_enabled?: boolean
          chat_enabled?: boolean
          created_at?: string
          doors_open?: boolean
          ends_at?: string | null
          event_id?: string
          host_sponsor_id?: string | null
          id?: string
          is_headline?: boolean
          position?: number
          recording_path?: string | null
          sector_slug?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          title?: string
          type?: Database["public"]["Enums"]["session_type"]
          updated_at?: string
          video_provider?: string | null
          video_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_host_sponsor_id_fkey"
            columns: ["host_sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_audit_events: {
        Row: {
          actor: string | null
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          request_id: string
          user_agent: string | null
        }
        Insert: {
          actor?: string | null
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          request_id: string
          user_agent?: string | null
        }
        Update: {
          actor?: string | null
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          request_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_audit_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "signature_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_fields: {
        Row: {
          auto_source: string | null
          created_at: string
          field_type: string
          height: number
          id: string
          options: Json | null
          page: number
          placeholder: string | null
          request_id: string
          required: boolean
          value: string | null
          width: number
          x: number
          y: number
        }
        Insert: {
          auto_source?: string | null
          created_at?: string
          field_type: string
          height: number
          id?: string
          options?: Json | null
          page?: number
          placeholder?: string | null
          request_id: string
          required?: boolean
          value?: string | null
          width: number
          x: number
          y: number
        }
        Update: {
          auto_source?: string | null
          created_at?: string
          field_type?: string
          height?: number
          id?: string
          options?: Json | null
          page?: number
          placeholder?: string | null
          request_id?: string
          required?: boolean
          value?: string | null
          width?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "signature_fields_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "signature_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_requests: {
        Row: {
          access_token: string | null
          changes_requested_at: string | null
          consent_accepted: boolean
          contract_document_id: string | null
          created_at: string
          created_by: string
          deal_label: string | null
          declined_at: string | null
          document_hash: string | null
          document_name: string
          expires_at: string | null
          id: string
          last_opened_at: string | null
          open_count: number
          page_count: number
          response_note: string | null
          sent_at: string | null
          signed_at: string | null
          signed_file_path: string | null
          signer_company: string | null
          signer_email: string | null
          signer_name: string | null
          source_file_path: string | null
          source_format: string
          status: string
          viewed_at: string | null
          voided_at: string | null
          working_file_path: string
        }
        Insert: {
          access_token?: string | null
          changes_requested_at?: string | null
          consent_accepted?: boolean
          contract_document_id?: string | null
          created_at?: string
          created_by: string
          deal_label?: string | null
          declined_at?: string | null
          document_hash?: string | null
          document_name: string
          expires_at?: string | null
          id?: string
          last_opened_at?: string | null
          open_count?: number
          page_count?: number
          response_note?: string | null
          sent_at?: string | null
          signed_at?: string | null
          signed_file_path?: string | null
          signer_company?: string | null
          signer_email?: string | null
          signer_name?: string | null
          source_file_path?: string | null
          source_format?: string
          status?: string
          viewed_at?: string | null
          voided_at?: string | null
          working_file_path: string
        }
        Update: {
          access_token?: string | null
          changes_requested_at?: string | null
          consent_accepted?: boolean
          contract_document_id?: string | null
          created_at?: string
          created_by?: string
          deal_label?: string | null
          declined_at?: string | null
          document_hash?: string | null
          document_name?: string
          expires_at?: string | null
          id?: string
          last_opened_at?: string | null
          open_count?: number
          page_count?: number
          response_note?: string | null
          sent_at?: string | null
          signed_at?: string | null
          signed_file_path?: string | null
          signer_company?: string | null
          signer_email?: string | null
          signer_name?: string | null
          source_file_path?: string | null
          source_format?: string
          status?: string
          viewed_at?: string | null
          voided_at?: string | null
          working_file_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "signature_requests_contract_document_id_fkey"
            columns: ["contract_document_id"]
            isOneToOne: false
            referencedRelation: "contract_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          access_token: string | null
          assigned_to: string | null
          connected_by: string | null
          created_at: string
          disconnected_at: string | null
          display_name: string | null
          external_member_id: string | null
          id: string
          is_default: boolean
          label: string | null
          owner_profile_id: string | null
          platform: string
          refresh_token: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          assigned_to?: string | null
          connected_by?: string | null
          created_at?: string
          disconnected_at?: string | null
          display_name?: string | null
          external_member_id?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          owner_profile_id?: string | null
          platform?: string
          refresh_token?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          assigned_to?: string | null
          connected_by?: string | null
          created_at?: string
          disconnected_at?: string | null
          display_name?: string | null
          external_member_id?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          owner_profile_id?: string | null
          platform?: string
          refresh_token?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_accounts_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_accounts_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_accounts_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_alert_rules: {
        Row: {
          campaign_id: string | null
          channel: string
          created_at: string
          created_by: string | null
          direction: string
          enabled: boolean
          grain: string
          id: string
          last_fired_at: string | null
          metric: string
          owner_profile_id: string | null
          threshold_pct: number
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          direction: string
          enabled?: boolean
          grain?: string
          id?: string
          last_fired_at?: string | null
          metric: string
          owner_profile_id?: string | null
          threshold_pct?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          direction?: string
          enabled?: boolean
          grain?: string
          id?: string
          last_fired_at?: string | null
          metric?: string
          owner_profile_id?: string | null
          threshold_pct?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_alert_rules_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "social_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_alert_rules_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_campaign_goals: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string | null
          goal_clicks: number | null
          goal_conversions: number | null
          goal_impressions: number | null
          goal_meetings: number | null
          goal_outreach: number | null
          grain: string
          id: string
          owner_profile_id: string | null
          period_start: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by?: string | null
          goal_clicks?: number | null
          goal_conversions?: number | null
          goal_impressions?: number | null
          goal_meetings?: number | null
          goal_outreach?: number | null
          grain: string
          id?: string
          owner_profile_id?: string | null
          period_start: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          goal_clicks?: number | null
          goal_conversions?: number | null
          goal_impressions?: number | null
          goal_meetings?: number | null
          goal_outreach?: number | null
          grain?: string
          id?: string
          owner_profile_id?: string | null
          period_start?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_campaign_goals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "social_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_campaign_goals_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_campaigns: {
        Row: {
          archived_at: string | null
          budget_cents: number
          created_at: string
          created_by: string | null
          id: string
          name: string
          owner_profile_id: string | null
          source_tag: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          budget_cents?: number
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          owner_profile_id?: string | null
          source_tag: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          budget_cents?: number
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          owner_profile_id?: string | null
          source_tag?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_campaigns_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_clicks: {
        Row: {
          campaign_id: string | null
          created_at: string
          id: string
          owner_profile_id: string | null
          post_id: string | null
          source_tag: string | null
          user_agent: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          owner_profile_id?: string | null
          post_id?: string | null
          source_tag?: string | null
          user_agent?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          owner_profile_id?: string | null
          post_id?: string | null
          source_tag?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_clicks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "social_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_clicks_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_clicks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_connect_invites: {
        Row: {
          account_id: string | null
          assigned_to: string | null
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          is_default: boolean
          label: string | null
          platform: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          account_id?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          expires_at: string
          id?: string
          is_default?: boolean
          label?: string | null
          platform?: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          account_id?: string | null
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          platform?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_connect_invites_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_connect_invites_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_connect_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_outreach_drafts: {
        Row: {
          body: string
          campaign_id: string | null
          company_id: string
          compliance_status: string
          copied_at: string | null
          created_at: string
          draft_type: string
          founder_id: string
          id: string
          platform: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          campaign_id?: string | null
          company_id: string
          compliance_status?: string
          copied_at?: string | null
          created_at?: string
          draft_type: string
          founder_id: string
          id?: string
          platform?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          campaign_id?: string | null
          company_id?: string
          compliance_status?: string
          copied_at?: string | null
          created_at?: string
          draft_type?: string
          founder_id?: string
          id?: string
          platform?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_outreach_drafts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "outreach_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_outreach_drafts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_outreach_drafts_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          archetype: string | null
          archived_at: string | null
          body: string
          brief: string | null
          campaign_id: string | null
          comment_text: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          department: string | null
          held_until: string | null
          id: string
          image_url: string | null
          link_url: string | null
          owner_profile_id: string | null
          recurrence_id: string | null
          scheduled_at: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          archetype?: string | null
          archived_at?: string | null
          body: string
          brief?: string | null
          campaign_id?: string | null
          comment_text?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department?: string | null
          held_until?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          owner_profile_id?: string | null
          recurrence_id?: string | null
          scheduled_at?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          archetype?: string | null
          archived_at?: string | null
          body?: string
          brief?: string | null
          campaign_id?: string | null
          comment_text?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department?: string | null
          held_until?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          owner_profile_id?: string | null
          recurrence_id?: string | null
          scheduled_at?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "social_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_recurrence_id_fkey"
            columns: ["recurrence_id"]
            isOneToOne: false
            referencedRelation: "social_recurrences"
            referencedColumns: ["id"]
          },
        ]
      }
      social_recurrences: {
        Row: {
          account_ids: string[]
          archetype: string | null
          body: string
          brief: string | null
          campaign_id: string | null
          comment_text: string | null
          created_at: string
          created_by: string | null
          department: string | null
          end_count: number | null
          end_date: string | null
          end_type: string
          freq: string
          id: string
          image_url: string | null
          interval_n: number
          link_url: string | null
          made_count: number
          next_run: string | null
          owner_profile_id: string | null
          start_date: string
          status: string
          time_local: string
          updated_at: string
          variants: Json
          weekdays: number[]
        }
        Insert: {
          account_ids?: string[]
          archetype?: string | null
          body?: string
          brief?: string | null
          campaign_id?: string | null
          comment_text?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          end_count?: number | null
          end_date?: string | null
          end_type?: string
          freq: string
          id?: string
          image_url?: string | null
          interval_n?: number
          link_url?: string | null
          made_count?: number
          next_run?: string | null
          owner_profile_id?: string | null
          start_date: string
          status?: string
          time_local?: string
          updated_at?: string
          variants?: Json
          weekdays?: number[]
        }
        Update: {
          account_ids?: string[]
          archetype?: string | null
          body?: string
          brief?: string | null
          campaign_id?: string | null
          comment_text?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          end_count?: number | null
          end_date?: string | null
          end_type?: string
          freq?: string
          id?: string
          image_url?: string | null
          interval_n?: number
          link_url?: string | null
          made_count?: number
          next_run?: string | null
          owner_profile_id?: string | null
          start_date?: string
          status?: string
          time_local?: string
          updated_at?: string
          variants?: Json
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "social_recurrences_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "social_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_recurrences_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_settings: {
        Row: {
          approve_before_publish: boolean
          auto_publish: boolean
          id: number
          rewrite_per_account: boolean
          rotation: string[]
          skip_empty_slot: boolean
          updated_at: string
        }
        Insert: {
          approve_before_publish?: boolean
          auto_publish?: boolean
          id?: number
          rewrite_per_account?: boolean
          rotation?: string[]
          skip_empty_slot?: boolean
          updated_at?: string
        }
        Update: {
          approve_before_publish?: boolean
          auto_publish?: boolean
          id?: number
          rewrite_per_account?: boolean
          rotation?: string[]
          skip_empty_slot?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      social_slots: {
        Row: {
          created_at: string
          id: string
          time_local: string
          weekday: number
        }
        Insert: {
          created_at?: string
          id?: string
          time_local: string
          weekday: number
        }
        Update: {
          created_at?: string
          id?: string
          time_local?: string
          weekday?: number
        }
        Relationships: []
      }
      social_variants: {
        Row: {
          account_id: string
          attempts: number
          body: string
          busy: boolean
          comment_text: string | null
          created_at: string
          error: string | null
          event_color: string | null
          external_id: string | null
          gcal_event_id: string | null
          id: string
          idempotency_key: string
          next_attempt_at: string | null
          post_id: string
          published_at: string | null
          scheduled_at: string | null
          status: string
          updated_at: string
          url: string | null
        }
        Insert: {
          account_id: string
          attempts?: number
          body: string
          busy?: boolean
          comment_text?: string | null
          created_at?: string
          error?: string | null
          event_color?: string | null
          external_id?: string | null
          gcal_event_id?: string | null
          id?: string
          idempotency_key: string
          next_attempt_at?: string | null
          post_id: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          account_id?: string
          attempts?: number
          body?: string
          busy?: boolean
          comment_text?: string | null
          created_at?: string
          error?: string | null
          event_color?: string | null
          external_id?: string | null
          gcal_event_id?: string | null
          id?: string
          idempotency_key?: string
          next_attempt_at?: string | null
          post_id?: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_variants_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_variants_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      speaker_application_reviews: {
        Row: {
          application_id: string
          created_at: string
          id: string
          note: string | null
          recommendation: Database["public"]["Enums"]["review_recommendation"]
          reviewer_id: string
          rubric_scores: Json
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          note?: string | null
          recommendation?: Database["public"]["Enums"]["review_recommendation"]
          reviewer_id: string
          rubric_scores?: Json
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          note?: string | null
          recommendation?: Database["public"]["Enums"]["review_recommendation"]
          reviewer_id?: string
          rubric_scores?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "speaker_application_reviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "speaker_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaker_application_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      speaker_applications: {
        Row: {
          ai_intro: string | null
          ai_review: Json | null
          ai_reviewed_at: string | null
          applicant_id: string
          applicant_role: string
          bio: string | null
          booth_sponsor_id: string | null
          company_summary: string | null
          created_at: string
          decided_at: string | null
          decision_note: string | null
          disclaimer_accepted_at: string | null
          event_id: string
          id: string
          kind: Database["public"]["Enums"]["speaker_application_kind"]
          links: Json
          reviewer_id: string | null
          rubric_scores: Json
          sector_slug: string | null
          status: Database["public"]["Enums"]["speaker_application_status"]
          topic: string
          transcript: string | null
          video_bytes: number | null
          video_height: number | null
          video_path: string | null
          video_seconds: number | null
          video_type: string | null
          video_width: number | null
          wants_booth: boolean
          youtube_video_id: string | null
        }
        Insert: {
          ai_intro?: string | null
          ai_review?: Json | null
          ai_reviewed_at?: string | null
          applicant_id: string
          applicant_role: string
          bio?: string | null
          booth_sponsor_id?: string | null
          company_summary?: string | null
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          disclaimer_accepted_at?: string | null
          event_id: string
          id?: string
          kind?: Database["public"]["Enums"]["speaker_application_kind"]
          links?: Json
          reviewer_id?: string | null
          rubric_scores?: Json
          sector_slug?: string | null
          status?: Database["public"]["Enums"]["speaker_application_status"]
          topic: string
          transcript?: string | null
          video_bytes?: number | null
          video_height?: number | null
          video_path?: string | null
          video_seconds?: number | null
          video_type?: string | null
          video_width?: number | null
          wants_booth?: boolean
          youtube_video_id?: string | null
        }
        Update: {
          ai_intro?: string | null
          ai_review?: Json | null
          ai_reviewed_at?: string | null
          applicant_id?: string
          applicant_role?: string
          bio?: string | null
          booth_sponsor_id?: string | null
          company_summary?: string | null
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          disclaimer_accepted_at?: string | null
          event_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["speaker_application_kind"]
          links?: Json
          reviewer_id?: string | null
          rubric_scores?: Json
          sector_slug?: string | null
          status?: Database["public"]["Enums"]["speaker_application_status"]
          topic?: string
          transcript?: string | null
          video_bytes?: number | null
          video_height?: number | null
          video_path?: string | null
          video_seconds?: number | null
          video_type?: string | null
          video_width?: number | null
          wants_booth?: boolean
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "speaker_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaker_applications_booth_sponsor_id_fkey"
            columns: ["booth_sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaker_applications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaker_applications_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_leads: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          message: string | null
          profile_id: string
          sponsor_id: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          message?: string | null
          profile_id: string
          sponsor_id: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          message?: string | null
          profile_id?: string
          sponsor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_leads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_leads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_leads_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsors: {
        Row: {
          allow_contact_request: boolean
          archived_at: string | null
          blurb: string | null
          category: Database["public"]["Enums"]["sponsor_category"]
          category_exclusive: boolean
          created_at: string
          downloads: Json
          id: string
          is_founder_booth: boolean
          logo_path: string | null
          meeting_url: string | null
          name: string
          owner_id: string | null
          sector_slug: string | null
          tier: Database["public"]["Enums"]["sponsor_tier"]
          updated_at: string
          video_provider: string | null
          video_ref: string | null
          website: string | null
        }
        Insert: {
          allow_contact_request?: boolean
          archived_at?: string | null
          blurb?: string | null
          category?: Database["public"]["Enums"]["sponsor_category"]
          category_exclusive?: boolean
          created_at?: string
          downloads?: Json
          id?: string
          is_founder_booth?: boolean
          logo_path?: string | null
          meeting_url?: string | null
          name: string
          owner_id?: string | null
          sector_slug?: string | null
          tier?: Database["public"]["Enums"]["sponsor_tier"]
          updated_at?: string
          video_provider?: string | null
          video_ref?: string | null
          website?: string | null
        }
        Update: {
          allow_contact_request?: boolean
          archived_at?: string | null
          blurb?: string | null
          category?: Database["public"]["Enums"]["sponsor_category"]
          category_exclusive?: boolean
          created_at?: string
          downloads?: Json
          id?: string
          is_founder_booth?: boolean
          logo_path?: string | null
          meeting_url?: string | null
          name?: string
          owner_id?: string | null
          sector_slug?: string | null
          tier?: Database["public"]["Enums"]["sponsor_tier"]
          updated_at?: string
          video_provider?: string | null
          video_ref?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsors_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spv_checklist_items: {
        Row: {
          category: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string | null
          id: string
          item_key: string
          required: boolean
          spv_opportunity_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          item_key: string
          required?: boolean
          spv_opportunity_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          item_key?: string
          required?: boolean
          spv_opportunity_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spv_checklist_items_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spv_checklist_items_spv_opportunity_id_fkey"
            columns: ["spv_opportunity_id"]
            isOneToOne: false
            referencedRelation: "spv_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      spv_closing_reviews: {
        Row: {
          company_id: string
          created_at: string
          id: string
          internal_notes: string | null
          readiness_snapshot: Json
          reviewed_at: string | null
          reviewed_by: string | null
          spv_opportunity_id: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          internal_notes?: string | null
          readiness_snapshot?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          spv_opportunity_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          internal_notes?: string | null
          readiness_snapshot?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          spv_opportunity_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spv_closing_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spv_closing_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spv_closing_reviews_spv_opportunity_id_fkey"
            columns: ["spv_opportunity_id"]
            isOneToOne: true
            referencedRelation: "spv_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      spv_document_packages: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          id: string
          notes: string | null
          package_type: string
          prepared_at: string | null
          prepared_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          spv_opportunity_id: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          package_type: string
          prepared_at?: string | null
          prepared_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          spv_opportunity_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          package_type?: string
          prepared_at?: string | null
          prepared_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          spv_opportunity_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spv_document_packages_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spv_document_packages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spv_document_packages_prepared_by_fkey"
            columns: ["prepared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spv_document_packages_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spv_document_packages_spv_opportunity_id_fkey"
            columns: ["spv_opportunity_id"]
            isOneToOne: false
            referencedRelation: "spv_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      spv_opportunities: {
        Row: {
          checklist_readiness_pct: number
          closing_approved_notified: boolean
          closing_final_review_notified: boolean
          closing_readiness_pct: number
          closing_target_override: boolean
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          document_ready_at: string | null
          id: string
          investor_closing_status: string | null
          investor_package_status: string | null
          investor_pending_requirements_count: number
          investors_document_ready_count: number
          minimum_commitment: number | null
          name: string
          operational_readiness_status: string | null
          package_readiness_pct: number
          packages_fully_approved_notified: boolean
          status: string
          target_amount: number | null
          target_amount_reached_notified: boolean
          terms_summary: string | null
          updated_at: string
        }
        Insert: {
          checklist_readiness_pct?: number
          closing_approved_notified?: boolean
          closing_final_review_notified?: boolean
          closing_readiness_pct?: number
          closing_target_override?: boolean
          company_id: string
          created_at?: string
          created_by: string
          description?: string | null
          document_ready_at?: string | null
          id?: string
          investor_closing_status?: string | null
          investor_package_status?: string | null
          investor_pending_requirements_count?: number
          investors_document_ready_count?: number
          minimum_commitment?: number | null
          name: string
          operational_readiness_status?: string | null
          package_readiness_pct?: number
          packages_fully_approved_notified?: boolean
          status?: string
          target_amount?: number | null
          target_amount_reached_notified?: boolean
          terms_summary?: string | null
          updated_at?: string
        }
        Update: {
          checklist_readiness_pct?: number
          closing_approved_notified?: boolean
          closing_final_review_notified?: boolean
          closing_readiness_pct?: number
          closing_target_override?: boolean
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          document_ready_at?: string | null
          id?: string
          investor_closing_status?: string | null
          investor_package_status?: string | null
          investor_pending_requirements_count?: number
          investors_document_ready_count?: number
          minimum_commitment?: number | null
          name?: string
          operational_readiness_status?: string | null
          package_readiness_pct?: number
          packages_fully_approved_notified?: boolean
          status?: string
          target_amount?: number | null
          target_amount_reached_notified?: boolean
          terms_summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spv_opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spv_opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spv_participation_requirements: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          investor_id: string
          required: boolean
          requirement_key: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          spv_opportunity_id: string
          spv_participation_id: string
          status: string
          title: string
          updated_at: string
          uploaded_document_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          investor_id: string
          required?: boolean
          requirement_key: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          spv_opportunity_id: string
          spv_participation_id: string
          status?: string
          title: string
          updated_at?: string
          uploaded_document_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          investor_id?: string
          required?: boolean
          requirement_key?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          spv_opportunity_id?: string
          spv_participation_id?: string
          status?: string
          title?: string
          updated_at?: string
          uploaded_document_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spv_participation_requirements_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spv_participation_requirements_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spv_participation_requirements_spv_opportunity_id_fkey"
            columns: ["spv_opportunity_id"]
            isOneToOne: false
            referencedRelation: "spv_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spv_participation_requirements_spv_participation_id_fkey"
            columns: ["spv_participation_id"]
            isOneToOne: false
            referencedRelation: "spv_participations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spv_participation_requirements_uploaded_document_id_fkey"
            columns: ["uploaded_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      spv_participations: {
        Row: {
          company_id: string
          created_at: string
          document_readiness_pct: number
          document_ready_at: string | null
          id: string
          indicative_amount: number | null
          investor_id: string
          notes: string | null
          spv_opportunity_id: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          document_readiness_pct?: number
          document_ready_at?: string | null
          id?: string
          indicative_amount?: number | null
          investor_id: string
          notes?: string | null
          spv_opportunity_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          document_readiness_pct?: number
          document_ready_at?: string | null
          id?: string
          indicative_amount?: number | null
          investor_id?: string
          notes?: string | null
          spv_opportunity_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spv_participations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spv_participations_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spv_participations_spv_opportunity_id_fkey"
            columns: ["spv_opportunity_id"]
            isOneToOne: false
            referencedRelation: "spv_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_gate_reminders: {
        Row: {
          company_id: string
          created_at: string
          founder_id: string | null
          gate_key: string
          id: string
          last_sent_at: string | null
          next_send_at: string | null
          one_time: boolean
          paused: boolean
          resolved_at: string | null
          sends_count: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          founder_id?: string | null
          gate_key: string
          id?: string
          last_sent_at?: string | null
          next_send_at?: string | null
          one_time?: boolean
          paused?: boolean
          resolved_at?: string | null
          sends_count?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          founder_id?: string | null
          gate_key?: string
          id?: string
          last_sent_at?: string | null
          next_send_at?: string | null
          one_time?: boolean
          paused?: boolean
          resolved_at?: string | null
          sends_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_gate_reminders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_gate_reminders_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          cancel_at_period_end: boolean
          cancel_reason: string | null
          pending_plan_type: string | null
          pending_plan_effective_at: string | null
          currency: string
          current_period_end: string | null
          current_period_start: string | null
          grace_period_ends_at: string | null
          grandfathered_free: boolean
          id: string
          is_grandfathered: boolean
          ls_customer_id: string | null
          ls_subscription_id: string | null
          ls_variant_id: string | null
          monthly_price_cents: number
          plan_type: string
          profile_id: string
          role: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cancel_at_period_end?: boolean
          cancel_reason?: string | null
          pending_plan_type?: string | null
          pending_plan_effective_at?: string | null
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_period_ends_at?: string | null
          grandfathered_free?: boolean
          id?: string
          is_grandfathered?: boolean
          ls_customer_id?: string | null
          ls_subscription_id?: string | null
          ls_variant_id?: string | null
          monthly_price_cents?: number
          plan_type: string
          profile_id: string
          role: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cancel_at_period_end?: boolean
          cancel_reason?: string | null
          pending_plan_type?: string | null
          pending_plan_effective_at?: string | null
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_period_ends_at?: string | null
          grandfathered_free?: boolean
          id?: string
          is_grandfathered?: boolean
          ls_customer_id?: string | null
          ls_subscription_id?: string | null
          ls_variant_id?: string | null
          monthly_price_cents?: number
          plan_type?: string
          profile_id?: string
          role?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_events: {
        Row: {
          actor: string
          actor_user_id: string | null
          created_at: string
          detail: string | null
          founder_id: string | null
          id: string
          kind: string
          meta: Json | null
          request_id: string | null
          summary: string
        }
        Insert: {
          actor: string
          actor_user_id?: string | null
          created_at?: string
          detail?: string | null
          founder_id?: string | null
          id?: string
          kind: string
          meta?: Json | null
          request_id?: string | null
          summary: string
        }
        Update: {
          actor?: string
          actor_user_id?: string | null
          created_at?: string
          detail?: string | null
          founder_id?: string | null
          id?: string
          kind?: string
          meta?: Json | null
          request_id?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_events_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "support_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          attachments: Json
          author_role: string
          author_user_id: string
          body: string
          created_at: string
          id: string
          is_internal: boolean
          request_id: string
        }
        Insert: {
          attachments?: Json
          author_role: string
          author_user_id: string
          body: string
          created_at?: string
          id?: string
          is_internal?: boolean
          request_id: string
        }
        Update: {
          attachments?: Json
          author_role?: string
          author_user_id?: string
          body?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "support_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          ai_triage: Json | null
          assigned_to: string | null
          closed_at: string | null
          company_id: string
          confirm_reminded_at: string | null
          context_item: string | null
          context_stage: string | null
          created_at: string
          csat: number | null
          due_at: string | null
          due_soon_alerted_at: string | null
          first_staff_reply_at: string | null
          founder_id: string
          founder_nudged_at: string | null
          id: string
          last_reminder_at: string | null
          overdue_alerted_at: string | null
          priority: string
          rating: number | null
          rating_comment: string | null
          ref_no: number
          reminder_count: number
          reopened_count: number
          resolution_summary: string | null
          resolved_at: string | null
          source: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          ai_triage?: Json | null
          assigned_to?: string | null
          closed_at?: string | null
          company_id: string
          confirm_reminded_at?: string | null
          context_item?: string | null
          context_stage?: string | null
          created_at?: string
          csat?: number | null
          due_at?: string | null
          due_soon_alerted_at?: string | null
          first_staff_reply_at?: string | null
          founder_id: string
          founder_nudged_at?: string | null
          id?: string
          last_reminder_at?: string | null
          overdue_alerted_at?: string | null
          priority?: string
          rating?: number | null
          rating_comment?: string | null
          ref_no?: number
          reminder_count?: number
          reopened_count?: number
          resolution_summary?: string | null
          resolved_at?: string | null
          source?: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          ai_triage?: Json | null
          assigned_to?: string | null
          closed_at?: string | null
          company_id?: string
          confirm_reminded_at?: string | null
          context_item?: string | null
          context_stage?: string | null
          created_at?: string
          csat?: number | null
          due_at?: string | null
          due_soon_alerted_at?: string | null
          first_staff_reply_at?: string | null
          founder_id?: string
          founder_nudged_at?: string | null
          id?: string
          last_reminder_at?: string | null
          overdue_alerted_at?: string | null
          priority?: string
          rating?: number | null
          rating_comment?: string | null
          ref_no?: number
          reminder_count?: number
          reopened_count?: number
          resolution_summary?: string | null
          resolved_at?: string | null
          source?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_requests_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          context_id: string | null
          context_type: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          google_calendar_event_id: string | null
          id: string
          priority: string
          status: string
          task_category: string | null
          task_type: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          context_id?: string | null
          context_type?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          google_calendar_event_id?: string | null
          id?: string
          priority?: string
          status?: string
          task_category?: string | null
          task_type?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          context_id?: string | null
          context_type?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          google_calendar_event_id?: string | null
          id?: string
          priority?: string
          status?: string
          task_category?: string | null
          task_type?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_meetings: {
        Row: {
          calendar_host_user_id: string | null
          company_id: string
          created_at: string
          external_calendar_event_id: string | null
          external_calendar_provider: string | null
          external_meet_url: string | null
          founder_id: string
          id: string
          investor_id: string
          meeting_notes: string | null
          meeting_title: string | null
          proposed_end_time: string | null
          proposed_start_time: string | null
          requested_by: string
          status: string
          thread_id: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          calendar_host_user_id?: string | null
          company_id: string
          created_at?: string
          external_calendar_event_id?: string | null
          external_calendar_provider?: string | null
          external_meet_url?: string | null
          founder_id: string
          id?: string
          investor_id: string
          meeting_notes?: string | null
          meeting_title?: string | null
          proposed_end_time?: string | null
          proposed_start_time?: string | null
          requested_by: string
          status?: string
          thread_id: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          calendar_host_user_id?: string | null
          company_id?: string
          created_at?: string
          external_calendar_event_id?: string | null
          external_calendar_provider?: string | null
          external_meet_url?: string | null
          founder_id?: string
          id?: string
          investor_id?: string
          meeting_notes?: string | null
          meeting_title?: string | null
          proposed_end_time?: string | null
          proposed_start_time?: string | null
          requested_by?: string
          status?: string
          thread_id?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_meetings_calendar_host_user_id_fkey"
            columns: ["calendar_host_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_meetings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_meetings_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_meetings_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_meetings_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_meetings_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          message_type: string
          read_at: string | null
          sender_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          message_type?: string
          read_at?: string | null
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          message_type?: string
          read_at?: string | null
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      upgrade_requests: {
        Row: {
          created_at: string
          feature_key: string | null
          id: string
          notes: string | null
          profile_id: string
          request_type: string
          requested_plan: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          feature_key?: string | null
          id?: string
          notes?: string | null
          profile_id: string
          request_type: string
          requested_plan?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          feature_key?: string | null
          id?: string
          notes?: string | null
          profile_id?: string
          request_type?: string
          requested_plan?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "upgrade_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          acknowledged_stage: string | null
          created_at: string
          email_signature: string | null
          profile_id: string
          show_tips: boolean
          tips_dismissed_on: string | null
          updated_at: string
        }
        Insert: {
          acknowledged_stage?: string | null
          created_at?: string
          email_signature?: string | null
          profile_id: string
          show_tips?: boolean
          tips_dismissed_on?: string | null
          updated_at?: string
        }
        Update: {
          acknowledged_stage?: string | null
          created_at?: string
          email_signature?: string | null
          profile_id?: string
          show_tips?: boolean
          tips_dismissed_on?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_reminders: {
        Row: {
          contact_id: string | null
          created_at: string
          done_at: string | null
          due_at: string
          id: string
          kind: string
          notified_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          done_at?: string | null
          due_at: string
          id?: string
          kind?: string
          notified_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          done_at?: string | null
          due_at?: string
          id?: string
          kind?: string
          notified_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_reminders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "founder_investor_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      valuation_advice: {
        Row: {
          caution: string | null
          generated_at: string
          id: string
          is_sample: boolean
          levers: Json
          model: string | null
          read: string | null
          spread: string | null
          valuation_id: string
        }
        Insert: {
          caution?: string | null
          generated_at?: string
          id?: string
          is_sample?: boolean
          levers?: Json
          model?: string | null
          read?: string | null
          spread?: string | null
          valuation_id: string
        }
        Update: {
          caution?: string | null
          generated_at?: string
          id?: string
          is_sample?: boolean
          levers?: Json
          model?: string | null
          read?: string | null
          spread?: string | null
          valuation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "valuation_advice_valuation_id_fkey"
            columns: ["valuation_id"]
            isOneToOne: false
            referencedRelation: "valuations"
            referencedColumns: ["id"]
          },
        ]
      }
      valuation_methods: {
        Row: {
          basis_text: string | null
          high: number
          id: string
          low: number
          method_code: string
          sort_order: number
          valuation_id: string
        }
        Insert: {
          basis_text?: string | null
          high: number
          id?: string
          low: number
          method_code: string
          sort_order?: number
          valuation_id: string
        }
        Update: {
          basis_text?: string | null
          high?: number
          id?: string
          low?: number
          method_code?: string
          sort_order?: number
          valuation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "valuation_methods_valuation_id_fkey"
            columns: ["valuation_id"]
            isOneToOne: false
            referencedRelation: "valuations"
            referencedColumns: ["id"]
          },
        ]
      }
      valuations: {
        Row: {
          company_name: string
          converged_high: number | null
          converged_low: number | null
          created_at: string
          created_by: string
          id: string
          input_provenance: Json
          inputs: Json
          is_scenario: boolean
          organization_id: string
          sector: string | null
          source: Database["public"]["Enums"]["valuation_source"]
          stage_profile: Database["public"]["Enums"]["valuation_stage_profile"]
          updated_at: string
        }
        Insert: {
          company_name: string
          converged_high?: number | null
          converged_low?: number | null
          created_at?: string
          created_by: string
          id?: string
          input_provenance?: Json
          inputs?: Json
          is_scenario?: boolean
          organization_id: string
          sector?: string | null
          source: Database["public"]["Enums"]["valuation_source"]
          stage_profile: Database["public"]["Enums"]["valuation_stage_profile"]
          updated_at?: string
        }
        Update: {
          company_name?: string
          converged_high?: number | null
          converged_low?: number | null
          created_at?: string
          created_by?: string
          id?: string
          input_provenance?: Json
          inputs?: Json
          is_scenario?: boolean
          organization_id?: string
          sector?: string | null
          source?: Database["public"]["Enums"]["valuation_source"]
          stage_profile?: Database["public"]["Enums"]["valuation_stage_profile"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "valuations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vocabulary_options: {
        Row: {
          archived: boolean
          created_at: string
          description: string | null
          id: string
          label: string
          list: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          description?: string | null
          id?: string
          label: string
          list: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          list?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      voice_cadence_enrollments: {
        Row: {
          campaign_id: string
          contact_id: string
          current_step: number
          enrolled_at: string
          id: string
          last_error: string | null
          next_run_at: string
          retry_count: number
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          contact_id: string
          current_step?: number
          enrolled_at?: string
          id?: string
          last_error?: string | null
          next_run_at?: string
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          contact_id?: string
          current_step?: number
          enrolled_at?: string
          id?: string
          last_error?: string | null
          next_run_at?: string
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_cadence_enrollments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "voice_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_campaigns: {
        Row: {
          audience: string
          audience_config: Json | null
          cadence_steps: Json | null
          created_at: string
          guardrail_prompt_version: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          audience: string
          audience_config?: Json | null
          cadence_steps?: Json | null
          created_at?: string
          guardrail_prompt_version?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          audience?: string
          audience_config?: Json | null
          cadence_steps?: Json | null
          created_at?: string
          guardrail_prompt_version?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      voice_live_calls: {
        Row: {
          ai_disclosed: boolean
          call_id: string
          campaign_id: string | null
          company: string | null
          contact_id: string | null
          contact_name: string | null
          started_at: string
          status: string
          updated_at: string
          variant_id: string | null
          variant_label: string | null
        }
        Insert: {
          ai_disclosed?: boolean
          call_id: string
          campaign_id?: string | null
          company?: string | null
          contact_id?: string | null
          contact_name?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          variant_id?: string | null
          variant_label?: string | null
        }
        Update: {
          ai_disclosed?: boolean
          call_id?: string
          campaign_id?: string | null
          company?: string | null
          contact_id?: string | null
          contact_name?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          variant_id?: string | null
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_live_calls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "voice_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_live_calls_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "campaign_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      wire_invoices: {
        Row: {
          amount_cents: number
          billing_cycle: string
          company_id: string | null
          created_at: string
          currency: string
          due_at: string
          id: string
          invoice_number: string
          is_renewal: boolean
          issued_at: string
          notes: string | null
          period_end: string | null
          period_start: string | null
          plan_type: string
          profile_id: string
          received_at: string | null
          received_by: string | null
          reminder_sent_at: string | null
          status: string
        }
        Insert: {
          amount_cents: number
          billing_cycle: string
          company_id?: string | null
          created_at?: string
          currency?: string
          due_at: string
          id?: string
          invoice_number: string
          is_renewal?: boolean
          issued_at?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_type?: string
          profile_id: string
          received_at?: string | null
          received_by?: string | null
          reminder_sent_at?: string | null
          status?: string
        }
        Update: {
          amount_cents?: number
          billing_cycle?: string
          company_id?: string | null
          created_at?: string
          currency?: string
          due_at?: string
          id?: string
          invoice_number?: string
          is_renewal?: boolean
          issued_at?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_type?: string
          profile_id?: string
          received_at?: string | null
          received_by?: string | null
          reminder_sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "wire_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wire_invoices_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wire_invoices_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      contact_sides: {
        Row: {
          company: string | null
          company_domain: string | null
          email: string | null
          id: string | null
          module: string | null
          resolved_side: string | null
          side_confidence: number | null
        }
        Insert: {
          company?: string | null
          company_domain?: string | null
          email?: string | null
          id?: string | null
          module?: string | null
          resolved_side?: string | null
          side_confidence?: number | null
        }
        Update: {
          company?: string | null
          company_domain?: string | null
          email?: string | null
          id?: string | null
          module?: string | null
          resolved_side?: string | null
          side_confidence?: number | null
        }
        Relationships: []
      }
      crm_country_facets: {
        Row: {
          contact_type: string | null
          country: string | null
          n: number | null
          source: string | null
        }
        Relationships: []
      }
      hot_queue: {
        Row: {
          approach: Json | null
          company: string | null
          company_domain: string | null
          contact_confidence: number | null
          converted: boolean | null
          email: string | null
          email_source: string | null
          email_status: string | null
          enrichment_status: string | null
          external_id: string | null
          id: string | null
          lead_prescore: number | null
          module: string | null
          name: string | null
          owner: string | null
          phone: string | null
          phone_source: string | null
          plan: string | null
          prescore_dims: Json | null
          raw: Json | null
          segment: string | null
          side: string | null
          side_confidence: number | null
          signals: Json | null
          source: string | null
          stage: string | null
          supabase_profile_id: string | null
          suppressed: boolean | null
          synced_at: string | null
          tags: string[] | null
        }
        Insert: {
          approach?: Json | null
          company?: string | null
          company_domain?: string | null
          contact_confidence?: number | null
          converted?: boolean | null
          email?: string | null
          email_source?: string | null
          email_status?: string | null
          enrichment_status?: string | null
          external_id?: string | null
          id?: string | null
          lead_prescore?: number | null
          module?: string | null
          name?: string | null
          owner?: string | null
          phone?: string | null
          phone_source?: string | null
          plan?: string | null
          prescore_dims?: Json | null
          raw?: Json | null
          segment?: string | null
          side?: string | null
          side_confidence?: number | null
          signals?: Json | null
          source?: string | null
          stage?: string | null
          supabase_profile_id?: string | null
          suppressed?: boolean | null
          synced_at?: string | null
          tags?: string[] | null
        }
        Update: {
          approach?: Json | null
          company?: string | null
          company_domain?: string | null
          contact_confidence?: number | null
          converted?: boolean | null
          email?: string | null
          email_source?: string | null
          email_status?: string | null
          enrichment_status?: string | null
          external_id?: string | null
          id?: string | null
          lead_prescore?: number | null
          module?: string | null
          name?: string | null
          owner?: string | null
          phone?: string | null
          phone_source?: string | null
          plan?: string | null
          prescore_dims?: Json | null
          raw?: Json | null
          segment?: string | null
          side?: string | null
          side_confidence?: number | null
          signals?: Json | null
          source?: string | null
          stage?: string | null
          supabase_profile_id?: string | null
          suppressed?: boolean | null
          synced_at?: string | null
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_supabase_profile_id_fkey"
            columns: ["supabase_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_segments: {
        Row: {
          approach: Json | null
          computed_segment: string | null
          id: string | null
          lead_prescore: number | null
          side: string | null
        }
        Insert: {
          approach?: Json | null
          computed_segment?: never
          id?: string | null
          lead_prescore?: number | null
          side?: string | null
        }
        Update: {
          approach?: Json | null
          computed_segment?: never
          id?: string | null
          lead_prescore?: number | null
          side?: string | null
        }
        Relationships: []
      }
      match_campaign_founder_fields: {
        Row: {
          company: string | null
          country: string | null
          email: string | null
          email_status: string | null
          founder_type: string | null
          funding_stages: string[] | null
          id: string | null
          industries: string[] | null
          industry_source: string | null
          name: string | null
          pipeline_stage: string | null
          seeking_amount: string[] | null
          seeking_investor_types: string[] | null
          stage_source: string | null
          supabase_profile_id: string | null
          suppressed: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_supabase_profile_id_fkey"
            columns: ["supabase_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_call_queue: {
        Row: {
          call_timezone: string | null
          contact_id: string | null
          jurisdiction: string | null
          module: string | null
          name: string | null
          phone: string | null
        }
        Relationships: []
      }
      v_ceo_kpi_meeting_monthly: {
        Row: {
          actual: number | null
          department_id: string | null
          goal: number | null
          kpi_id: string | null
          label: string | null
          period_start: string | null
          unit: string | null
        }
        Insert: {
          actual?: never
          department_id?: string | null
          goal?: never
          kpi_id?: string | null
          label?: string | null
          period_start?: never
          unit?: string | null
        }
        Update: {
          actual?: never
          department_id?: string | null
          goal?: never
          kpi_id?: string | null
          label?: string | null
          period_start?: never
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ceo_kpi_meeting_definitions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ceo_kpi_meeting_quarterly: {
        Row: {
          actual: number | null
          department_id: string | null
          goal: number | null
          kpi_id: string | null
          label: string | null
          period_start: string | null
          unit: string | null
        }
        Insert: {
          actual?: never
          department_id?: string | null
          goal?: never
          kpi_id?: string | null
          label?: string | null
          period_start?: never
          unit?: string | null
        }
        Update: {
          actual?: never
          department_id?: string | null
          goal?: never
          kpi_id?: string | null
          label?: string | null
          period_start?: never
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ceo_kpi_meeting_definitions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ceo_kpi_meeting_weekly: {
        Row: {
          actual: number | null
          department_id: string | null
          goal: number | null
          kpi_id: string | null
          label: string | null
          period_start: string | null
          unit: string | null
        }
        Insert: {
          actual?: never
          department_id?: string | null
          goal?: never
          kpi_id?: string | null
          label?: string | null
          period_start?: never
          unit?: string | null
        }
        Update: {
          actual?: never
          department_id?: string | null
          goal?: never
          kpi_id?: string | null
          label?: string | null
          period_start?: never
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ceo_kpi_meeting_definitions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ceo_kpi_meeting_ytd: {
        Row: {
          actual: number | null
          department_id: string | null
          goal: number | null
          kpi_id: string | null
          label: string | null
          period_start: string | null
          unit: string | null
        }
        Insert: {
          actual?: never
          department_id?: string | null
          goal?: never
          kpi_id?: string | null
          label?: string | null
          period_start?: never
          unit?: string | null
        }
        Update: {
          actual?: never
          department_id?: string | null
          goal?: never
          kpi_id?: string | null
          label?: string | null
          period_start?: never
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ceo_kpi_meeting_definitions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ceo_meeting_readiness: {
        Row: {
          department_id: string | null
          meeting_key: string | null
          position: number | null
          prepared_by: string | null
          section_id: string | null
          section_kind: string | null
          session_id: string | null
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ceo_meeting_section_entries_prepared_by_fkey"
            columns: ["prepared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_meeting_section_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ceo_meeting_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_meeting_sections_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ceo_meeting_sections_meeting_key_fkey"
            columns: ["meeting_key"]
            isOneToOne: false
            referencedRelation: "ceo_meetings"
            referencedColumns: ["key"]
          },
        ]
      }
      v_sales_forecast_actuals: {
        Row: {
          active_subs: number | null
          churned_mrr_cents: number | null
          churned_subs: number | null
          ending_mrr_cents: number | null
          month: string | null
          new_mrr_cents: number | null
          new_subs: number | null
          segment: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      ai_budget_status: {
        Args: never
        Returns: {
          calls: number
          category: string
          monthly_usd: number
          spent_usd: number
        }[]
      }
      ai_spend_breakdown: {
        Args: never
        Returns: {
          calls: number
          category: string
          cost_usd: number
          feature: string
        }[]
      }
      ai_spend_month: { Args: { p_category: string }; Returns: number }
      calc_meeting_kpi_goal: {
        Args: { p_as_of: string; p_kpi_id: string; p_period: string }
        Returns: number
      }
      can_admin_departments: { Args: { uid: string }; Returns: boolean }
      company_is_approved: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      contact_duplicate_groups: {
        Args: { p_limit?: number; p_offset?: number; p_q?: string }
        Returns: {
          email: string
          members: Json
          n: number
          total_extra: number
          total_groups: number
        }[]
      }
      contact_filter_facets: { Args: never; Returns: Json }
      contact_in_sales_pipeline: {
        Args: { p_email: string; p_id: string }
        Returns: boolean
      }
      contact_industries_override: {
        Args: { p_overrides: Json }
        Returns: Json
      }
      contact_role: {
        Args: { p_module: string; p_type: string }
        Returns: string
      }
      contacts_spec_where: {
        Args: {
          p_group_by: string
          p_group_value: string
          p_owner: string
          p_spec: Json
        }
        Returns: string
      }
      contract_record_open: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      contract_record_packet_open: {
        Args: { p_packet_id: string }
        Returns: undefined
      }
      count_contact_buckets: {
        Args: { p_group_by?: string; p_owner?: string; p_spec: Json }
        Returns: {
          n: number
          value: string
        }[]
      }
      dd_gate_on: {
        Args: { eid: string; sec: string; who: string }
        Returns: boolean
      }
      dd_is_admin: { Args: { eid: string }; Returns: boolean }
      dd_is_released: { Args: { eid: string }; Returns: boolean }
      dd_member_role: { Args: { eid: string }; Returns: string }
      dd_seed_engagement: { Args: { eid: string }; Returns: undefined }
      dev_patch_key_ok: { Args: { p_key: string }; Returns: boolean }
      dev_patch_pending: {
        Args: { p_key: string }
        Returns: {
          id: number
          patch: string
          title: string
        }[]
      }
      dev_patch_report: {
        Args: {
          p_id: number
          p_key: string
          p_result: string
          p_sha: string
          p_status: string
        }
        Returns: undefined
      }
      dev_script: { Args: never; Returns: string }
      flag_unapplied_payments: { Args: never; Returns: number }
      formd_firm_stem: { Args: { p_name: string }; Returns: string }
      formd_rollup_firms: { Args: never; Returns: number }
      get_companies_pledge_summaries: {
        Args: { p_company_ids: string[] }
        Returns: {
          company_id: string
          currency: string
          investor_count: number
          total_pledged: number
        }[]
      }
      get_user_features: {
        Args: { p_user_id: string }
        Returns: {
          feature_key: string
          hub_key: string
          label: string
          path: string
          sort_order: number
        }[]
      }
      get_user_hubs: {
        Args: { p_user_id: string }
        Returns: {
          hub_key: string
        }[]
      }
      internal_can_assign_super_admin: {
        Args: { target_user_id?: string }
        Returns: boolean
      }
      internal_can_manage_users: {
        Args: { target_user_id?: string }
        Returns: boolean
      }
      internal_user_has_permission: {
        Args: { permission_slug: string; target_user_id: string }
        Returns: boolean
      }
      internal_user_role_rank: {
        Args: { target_user_id?: string }
        Returns: number
      }
      internal_user_role_slug: {
        Args: { target_user_id?: string }
        Returns: string
      }
      investor_directory_refresh_network: { Args: never; Returns: number }
      investor_has_company_document_access: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      investor_owns_company: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      investor_profile_canon: { Args: { v: string }; Returns: string }
      investor_profile_merge: {
        Args: { p_overrides: Json; p_raw: Json }
        Returns: Json
      }
      ir_agent_can_edit: { Args: { target_org: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_internal_user: { Args: { uid: string }; Returns: boolean }
      is_investor: { Args: never; Returns: boolean }
      is_member: { Args: { target_org: string }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      is_super_admin_user: {
        Args: { target_user_id?: string }
        Returns: boolean
      }
      learning_company_last_activity: {
        Args: never
        Returns: {
          company_id: string
          last_activity: string
        }[]
      }
      learning_leaderboard_stats: {
        Args: never
        Returns: {
          badges: number
          company_id: string
          modules_completed: number
          sum_percent: number
        }[]
      }
      learning_module_engagement_counts: {
        Args: never
        Returns: {
          cnt: number
          module_id: string
        }[]
      }
      linkedin_enrich_lookup: {
        Args: { p_emails: string[]; p_phones: string[] }
        Returns: {
          contact_company: string
          contact_id: string
          contact_name: string
          key: string
          kind: string
          source: string
        }[]
      }
      linkedin_enrich_next: {
        Args: { p_group: string; p_limit: number }
        Returns: {
          company: string
          company_domain: string
          email: string
          first_name: string
          id: string
          last_name: string
          name: string
          phone: string
          website: string
        }[]
      }
      linkedin_enrich_stats: {
        Args: { p_group: string }
        Returns: {
          companies: number
          contacts: number
          pending_companies: number
          pending_contacts: number
        }[]
      }
      linkedin_import_match: { Args: { p_rows: Json }; Returns: Json }
      linkedin_import_merge: { Args: { p_rows: Json }; Returns: number }
      linkedin_known_domains: {
        Args: { p_companies: string[] }
        Returns: {
          company: string
          domain: string
        }[]
      }
      mc_jsonb_texts: { Args: { j: Json }; Returns: string[] }
      merge_contact_overrides: {
        Args: { p_id: string; p_patch?: Json; p_remove?: string[] }
        Returns: Json
      }
      merge_crm_contacts: {
        Args: {
          p_by?: string
          p_fields?: Json
          p_keep: string
          p_merge: string[]
        }
        Returns: Json
      }
      money_band_for: { Args: { amount: number }; Returns: string }
      next_acct_invoice_number: { Args: { p_entity: string }; Returns: string }
      next_wire_invoice_number: { Args: never; Returns: string }
      person_name_key: { Args: { t: string }; Returns: string }
      phone_key: { Args: { t: string }; Returns: string }
      pre_dial_gate: { Args: { p_contact_id: string }; Returns: Json }
      profile_fill_queue: {
        Args: { p_group?: string }
        Returns: {
          contact_id: string
          pending: number
        }[]
      }
      promote_prospect_investor: {
        Args: { p_firm_id: string; p_lawful_basis: string }
        Returns: Json
      }
      refresh_meeting_kpi_goals: { Args: { p_as_of?: string }; Returns: number }
      sales_bulk_add_assignees: {
        Args: { p_ids: string[]; p_member_ids: string[] }
        Returns: number
      }
      search_contact_id_array: {
        Args: {
          p_group_by?: string
          p_group_value?: string
          p_limit?: number
          p_owner?: string
          p_spec: Json
        }
        Returns: string[]
      }
      search_contact_ids: {
        Args: {
          p_group_by?: string
          p_group_value?: string
          p_limit?: number
          p_owner?: string
          p_spec: Json
        }
        Returns: string[]
      }
      search_contacts: {
        Args: {
          p_count?: boolean
          p_dir?: string
          p_group_by?: string
          p_group_value?: string
          p_limit?: number
          p_offset?: number
          p_owner?: string
          p_sort?: string
          p_spec: Json
        }
        Returns: {
          assignee_ids: string[]
          company: string
          contact_type: string
          country: string
          created_on: string
          email: string
          external_id: string
          id: string
          ls_override: string
          ls_profile: string
          name: string
          phone: string
          raw_mobile: string
          raw_phone: string
          source: string
          synced_at: string
          total: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      undo_contact_merge: { Args: { p_batch: string }; Returns: Json }
      user_belongs_to_company: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      user_can_manage_company: {
        Args: { target_company_id: string }
        Returns: boolean
      }
    }
    Enums: {
      callin_status: "requested" | "invited" | "onstage" | "done"
      ceo_business: "icapos" | "icfo_spv"
      event_format: "showcase" | "demo_day" | "webinar" | "hybrid"
      event_invite_status: "invited" | "accepted" | "declined" | "withdrawn"
      event_sponsor_placement: "presenting" | "track" | "logo"
      event_status: "draft" | "published" | "live" | "ended" | "archived"
      event_visibility: "public" | "members"
      formd_lead_type: "issuer" | "investor" | "unclassified"
      guest_status: "backstage" | "onstage"
      introduction_status: "sent" | "accepted" | "declined"
      listing_status:
        | "draft"
        | "pending_review"
        | "live"
        | "paused"
        | "closed"
        | "rejected"
      match_status:
        | "suggested"
        | "investor_notified"
        | "investor_interested"
        | "founder_approved"
        | "introduced"
        | "declined_by_investor"
        | "declined_by_founder"
        | "expired"
      networking_connection_status: "requested" | "accepted" | "declined"
      offering_type: "reg_cf" | "reg_d_506b" | "reg_d_506c" | "not_raising"
      org_type: "founder" | "spv"
      registration_status: "registered" | "attended" | "no_show"
      review_recommendation: "approve" | "decline" | "abstain"
      segment_status: "pending" | "live" | "done"
      session_status: "draft" | "scheduled" | "live" | "ended"
      session_type:
        | "keynote"
        | "panel"
        | "talk_show"
        | "founder_showcase"
        | "workshop"
      speaker_application_kind:
        | "presenter"
        | "panelist"
        | "founder_showcase"
        | "exhibitor"
      speaker_application_status:
        | "submitted"
        | "under_review"
        | "approved"
        | "declined"
      sponsor_category: "legal" | "consulting" | "banking" | "other"
      sponsor_tier: "presenting" | "gold" | "silver" | "community"
      task_activity_event:
        | "created"
        | "updated"
        | "status_changed"
        | "priority_changed"
        | "attachment_added"
        | "attachment_removed"
        | "comment_added"
        | "archived"
        | "reopened"
      task_priority: "high" | "medium" | "low"
      task_status: "todo" | "in_progress" | "review" | "done"
      task_visibility: "admin_only" | "admin_assigned"
      valuation_arr_band: "<1M" | "1-5M" | "5-20M" | "20M+"
      valuation_source: "profile" | "manual"
      valuation_stage_profile: "preseed" | "seed" | "revenue"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      callin_status: ["requested", "invited", "onstage", "done"],
      ceo_business: ["icapos", "icfo_spv"],
      event_format: ["showcase", "demo_day", "webinar", "hybrid"],
      event_invite_status: ["invited", "accepted", "declined", "withdrawn"],
      event_sponsor_placement: ["presenting", "track", "logo"],
      event_status: ["draft", "published", "live", "ended", "archived"],
      event_visibility: ["public", "members"],
      formd_lead_type: ["issuer", "investor", "unclassified"],
      guest_status: ["backstage", "onstage"],
      introduction_status: ["sent", "accepted", "declined"],
      listing_status: [
        "draft",
        "pending_review",
        "live",
        "paused",
        "closed",
        "rejected",
      ],
      match_status: [
        "suggested",
        "investor_notified",
        "investor_interested",
        "founder_approved",
        "introduced",
        "declined_by_investor",
        "declined_by_founder",
        "expired",
      ],
      networking_connection_status: ["requested", "accepted", "declined"],
      offering_type: ["reg_cf", "reg_d_506b", "reg_d_506c", "not_raising"],
      org_type: ["founder", "spv"],
      registration_status: ["registered", "attended", "no_show"],
      review_recommendation: ["approve", "decline", "abstain"],
      segment_status: ["pending", "live", "done"],
      session_status: ["draft", "scheduled", "live", "ended"],
      session_type: [
        "keynote",
        "panel",
        "talk_show",
        "founder_showcase",
        "workshop",
      ],
      speaker_application_kind: [
        "presenter",
        "panelist",
        "founder_showcase",
        "exhibitor",
      ],
      speaker_application_status: [
        "submitted",
        "under_review",
        "approved",
        "declined",
      ],
      sponsor_category: ["legal", "consulting", "banking", "other"],
      sponsor_tier: ["presenting", "gold", "silver", "community"],
      task_activity_event: [
        "created",
        "updated",
        "status_changed",
        "priority_changed",
        "attachment_added",
        "attachment_removed",
        "comment_added",
        "archived",
        "reopened",
      ],
      task_priority: ["high", "medium", "low"],
      task_status: ["todo", "in_progress", "review", "done"],
      task_visibility: ["admin_only", "admin_assigned"],
      valuation_arr_band: ["<1M", "1-5M", "5-20M", "20M+"],
      valuation_source: ["profile", "manual"],
      valuation_stage_profile: ["preseed", "seed", "revenue"],
    },
  },
} as const
