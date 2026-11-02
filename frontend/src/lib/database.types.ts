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
      aq_contacts: {
        Row: {
          class_grade: string | null
          created_at: string
          email: string | null
          full_name: string
          id: number
          import_batch: string
          instagram: string | null
          matched_member_id: number | null
          phone_normalised: string | null
          phone_raw: string | null
          points_note: string | null
          school: string | null
          source_sheet: string
        }
        Insert: {
          class_grade?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: never
          import_batch: string
          instagram?: string | null
          matched_member_id?: number | null
          phone_normalised?: string | null
          phone_raw?: string | null
          points_note?: string | null
          school?: string | null
          source_sheet: string
        }
        Update: {
          class_grade?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: never
          import_batch?: string
          instagram?: string | null
          matched_member_id?: number | null
          phone_normalised?: string | null
          phone_raw?: string | null
          points_note?: string | null
          school?: string | null
          source_sheet?: string
        }
        Relationships: [
          {
            foreignKeyName: "aq_contacts_matched_member_id_fkey"
            columns: ["matched_member_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "aq_contacts_matched_member_id_fkey"
            columns: ["matched_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "aq_contacts_matched_member_id_fkey"
            columns: ["matched_member_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "aq_contacts_matched_member_id_fkey"
            columns: ["matched_member_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "aq_contacts_matched_member_id_fkey"
            columns: ["matched_member_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
        ]
      }
      arcade_scores: {
        Row: {
          game_id: string
          id: string
          member_uuid: string
          metadata: Json | null
          played_at: string | null
          score: number
        }
        Insert: {
          game_id: string
          id?: string
          member_uuid: string
          metadata?: Json | null
          played_at?: string | null
          score: number
        }
        Update: {
          game_id?: string
          id?: string
          member_uuid?: string
          metadata?: Json | null
          played_at?: string | null
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "arcade_scores_member_uuid_fkey"
            columns: ["member_uuid"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "arcade_scores_member_uuid_fkey"
            columns: ["member_uuid"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "arcade_scores_member_uuid_fkey"
            columns: ["member_uuid"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "arcade_scores_member_uuid_fkey"
            columns: ["member_uuid"]
            isOneToOne: false
            referencedRelation: "post_feed_view"
            referencedColumns: ["author_uuid"]
          },
          {
            foreignKeyName: "arcade_scores_member_uuid_fkey"
            columns: ["member_uuid"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["uuid"]
          },
        ]
      }
      arcade_trivia_questions: {
        Row: {
          answer: string
          category: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question: string
        }
        Insert: {
          answer: string
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question: string
        }
        Update: {
          answer?: string
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          option_a?: string
          option_b?: string
          option_c?: string
          option_d?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "arcade_trivia_questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "arcade_trivia_questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "arcade_trivia_questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "arcade_trivia_questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "post_feed_view"
            referencedColumns: ["author_uuid"]
          },
          {
            foreignKeyName: "arcade_trivia_questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["uuid"]
          },
        ]
      }
      blogs_retired_2026_09_12: {
        Row: {
          author_id: number | null
          author_instagram: string | null
          author_url: string | null
          body: string | null
          category: string
          content: string | null
          cover: string | null
          cover_alt: string | null
          created_at: string | null
          featured_image: string | null
          featured_image_alt: string | null
          headliner: string
          id: number
          linked_post_id: string | null
          minutes_of_read: number | null
          published_date: string | null
          slug: string
          written_by: string | null
        }
        Insert: {
          author_id?: number | null
          author_instagram?: string | null
          author_url?: string | null
          body?: string | null
          category?: string
          content?: string | null
          cover?: string | null
          cover_alt?: string | null
          created_at?: string | null
          featured_image?: string | null
          featured_image_alt?: string | null
          headliner: string
          id?: number
          linked_post_id?: string | null
          minutes_of_read?: number | null
          published_date?: string | null
          slug: string
          written_by?: string | null
        }
        Update: {
          author_id?: number | null
          author_instagram?: string | null
          author_url?: string | null
          body?: string | null
          category?: string
          content?: string | null
          cover?: string | null
          cover_alt?: string | null
          created_at?: string | null
          featured_image?: string | null
          featured_image_alt?: string | null
          headliner?: string
          id?: number
          linked_post_id?: string | null
          minutes_of_read?: number | null
          published_date?: string | null
          slug?: string
          written_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blogs_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "blogs_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "blogs_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "blogs_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "blogs_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "blogs_linked_post_id_fkey"
            columns: ["linked_post_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "blogs_linked_post_id_fkey"
            columns: ["linked_post_id"]
            isOneToOne: false
            referencedRelation: "post_feed_view"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "blogs_linked_post_id_fkey"
            columns: ["linked_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["uuid"]
          },
        ]
      }
      certificate_requests: {
        Row: {
          date_range_end: string | null
          date_range_start: string | null
          decided_at: string | null
          decided_by: number | null
          decision_note: string | null
          doc_type: string
          drive_count_at_request: number | null
          hours_at_request: number | null
          id: number
          member_id: number
          member_note: string | null
          requested_at: string
          status: string
        }
        Insert: {
          date_range_end?: string | null
          date_range_start?: string | null
          decided_at?: string | null
          decided_by?: number | null
          decision_note?: string | null
          doc_type: string
          drive_count_at_request?: number | null
          hours_at_request?: number | null
          id?: never
          member_id: number
          member_note?: string | null
          requested_at?: string
          status?: string
        }
        Update: {
          date_range_end?: string | null
          date_range_start?: string | null
          decided_at?: string | null
          decided_by?: number | null
          decision_note?: string | null
          doc_type?: string
          drive_count_at_request?: number | null
          hours_at_request?: number | null
          id?: never
          member_id?: number
          member_note?: string | null
          requested_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "certificate_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "certificate_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "certificate_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "certificate_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "certificate_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "certificate_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "certificate_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "certificate_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "certificate_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
        ]
      }
      client_error_logs: {
        Row: {
          component_stack: string | null
          created_at: string
          error_type: string
          extra: Json | null
          href: string
          id: string
          member_id: number | null
          member_uuid: string | null
          message: string
          pathname: string
          role: string | null
          session_id: string | null
          stack: string | null
          user_agent: string | null
          viewport_h: number | null
          viewport_w: number | null
        }
        Insert: {
          component_stack?: string | null
          created_at?: string
          error_type: string
          extra?: Json | null
          href: string
          id?: string
          member_id?: number | null
          member_uuid?: string | null
          message: string
          pathname: string
          role?: string | null
          session_id?: string | null
          stack?: string | null
          user_agent?: string | null
          viewport_h?: number | null
          viewport_w?: number | null
        }
        Update: {
          component_stack?: string | null
          created_at?: string
          error_type?: string
          extra?: Json | null
          href?: string
          id?: string
          member_id?: number | null
          member_uuid?: string | null
          message?: string
          pathname?: string
          role?: string | null
          session_id?: string | null
          stack?: string | null
          user_agent?: string | null
          viewport_h?: number | null
          viewport_w?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_error_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "client_error_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "client_error_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "client_error_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "client_error_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
        ]
      }
      collaboration_submissions: {
        Row: {
          collab_type: string | null
          contact_name: string
          created_at: string | null
          email: string
          id: number
          message: string
          org_name: string
          phone: string | null
          status: string | null
        }
        Insert: {
          collab_type?: string | null
          contact_name: string
          created_at?: string | null
          email: string
          id?: number
          message: string
          org_name: string
          phone?: string | null
          status?: string | null
        }
        Update: {
          collab_type?: string | null
          contact_name?: string
          created_at?: string | null
          email?: string
          id?: number
          message?: string
          org_name?: string
          phone?: string | null
          status?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_id: number
          body: string
          comment_id: number
          created_at: string | null
          parent_comment_id: number | null
          post_id: number
          updated_at: string | null
          uuid: string
        }
        Insert: {
          author_id: number
          body: string
          comment_id?: number
          created_at?: string | null
          parent_comment_id?: number | null
          post_id: number
          updated_at?: string | null
          uuid?: string
        }
        Update: {
          author_id?: number
          body?: string
          comment_id?: number
          created_at?: string | null
          parent_comment_id?: number | null
          post_id?: number
          updated_at?: string | null
          uuid?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["comment_id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "post_feed_view"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["post_id"]
          },
        ]
      }
      community_audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity_id: number | null
          entity_type: string | null
          ip_address: unknown
          log_id: number
          member_id: number | null
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity_id?: number | null
          entity_type?: string | null
          ip_address?: unknown
          log_id?: number
          member_id?: number | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: number | null
          entity_type?: string | null
          ip_address?: unknown
          log_id?: number
          member_id?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_audit_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "community_audit_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "community_audit_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "community_audit_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "community_audit_logs_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
        ]
      }
      contact_access_log: {
        Row: {
          action: string
          actor_id: number
          created_at: string
          field: string
          id: number
          target_id: number
        }
        Insert: {
          action: string
          actor_id: number
          created_at?: string
          field: string
          id?: never
          target_id: number
        }
        Update: {
          action?: string
          actor_id?: number
          created_at?: string
          field?: string
          id?: never
          target_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "contact_access_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "contact_access_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "contact_access_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "contact_access_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "contact_access_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "contact_access_log_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "contact_access_log_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "contact_access_log_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "contact_access_log_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "contact_access_log_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          created_at: string | null
          email: string
          id: number
          message: string | null
          name: string
          phone: string | null
          role: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: number
          message?: string | null
          name: string
          phone?: string | null
          role?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: number
          message?: string | null
          name?: string
          phone?: string | null
          role?: string | null
          status?: string
        }
        Relationships: []
      }
      desk_sops: {
        Row: {
          body: string
          created_at: string
          desk: string
          id: number
          published_at: string | null
          version: number
        }
        Insert: {
          body: string
          created_at?: string
          desk: string
          id?: never
          published_at?: string | null
          version?: number
        }
        Update: {
          body?: string
          created_at?: string
          desk?: string
          id?: never
          published_at?: string | null
          version?: number
        }
        Relationships: []
      }
      desk_todos: {
        Row: {
          assignee_id: number | null
          created_at: string
          desk: string
          done_at: string | null
          due_on: string | null
          id: number
          title: string
        }
        Insert: {
          assignee_id?: number | null
          created_at?: string
          desk: string
          done_at?: string | null
          due_on?: string | null
          id?: never
          title: string
        }
        Update: {
          assignee_id?: number | null
          created_at?: string
          desk?: string
          done_at?: string | null
          due_on?: string | null
          id?: never
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "desk_todos_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "desk_todos_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "desk_todos_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "desk_todos_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "desk_todos_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
        ]
      }
      director_categories: {
        Row: {
          assigned_at: string | null
          assigned_by: number | null
          assignment_id: number
          category: string
          member_id: number
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: number | null
          assignment_id?: number
          category: string
          member_id: number
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: number | null
          assignment_id?: number
          category?: string
          member_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "director_categories_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "director_categories_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "director_categories_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "director_categories_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "director_categories_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "director_categories_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "director_categories_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "director_categories_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "director_categories_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "director_categories_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
        ]
      }
      director_scopes: {
        Row: {
          assigned_at: string
          assigned_by: number | null
          member_id: number
          scope_id: number
          team_id: number
        }
        Insert: {
          assigned_at?: string
          assigned_by?: number | null
          member_id: number
          scope_id?: number
          team_id: number
        }
        Update: {
          assigned_at?: string
          assigned_by?: number | null
          member_id?: number
          scope_id?: number
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "director_scopes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "director_scopes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "director_scopes_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
        ]
      }
      drive_attendance: {
        Row: {
          checked_in_at: string | null
          checked_out_at: string | null
          consent_signed: boolean
          created_at: string
          id: number
          member_id: number | null
          status: string
          updated_at: string
          updated_by: number | null
          walkup_name: string | null
          welfare_project_id: number
        }
        Insert: {
          checked_in_at?: string | null
          checked_out_at?: string | null
          consent_signed?: boolean
          created_at?: string
          id?: never
          member_id?: number | null
          status?: string
          updated_at?: string
          updated_by?: number | null
          walkup_name?: string | null
          welfare_project_id: number
        }
        Update: {
          checked_in_at?: string | null
          checked_out_at?: string | null
          consent_signed?: boolean
          created_at?: string
          id?: never
          member_id?: number | null
          status?: string
          updated_at?: string
          updated_by?: number | null
          walkup_name?: string | null
          welfare_project_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "drive_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "drive_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "drive_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "drive_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "drive_attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "drive_attendance_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "drive_attendance_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "drive_attendance_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "drive_attendance_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "drive_attendance_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "drive_attendance_welfare_project_id_fkey"
            columns: ["welfare_project_id"]
            isOneToOne: false
            referencedRelation: "welfare_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      external_achievements: {
        Row: {
          achievement_date: string | null
          achievement_end_date: string | null
          achievement_id: number
          achievement_type: string | null
          created_at: string | null
          description: string | null
          member_id: number
          proof_url: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: number | null
          status: string
          title: string
          updated_at: string | null
          uuid: string
        }
        Insert: {
          achievement_date?: string | null
          achievement_end_date?: string | null
          achievement_id?: number
          achievement_type?: string | null
          created_at?: string | null
          description?: string | null
          member_id: number
          proof_url?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: number | null
          status?: string
          title: string
          updated_at?: string | null
          uuid?: string
        }
        Update: {
          achievement_date?: string | null
          achievement_end_date?: string | null
          achievement_id?: number
          achievement_type?: string | null
          created_at?: string | null
          description?: string | null
          member_id?: number
          proof_url?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: number | null
          status?: string
          title?: string
          updated_at?: string | null
          uuid?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_achievements_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "external_achievements_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "external_achievements_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "external_achievements_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "external_achievements_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "external_achievements_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "external_achievements_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "external_achievements_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "external_achievements_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "external_achievements_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follow_id: number
          followee_id: number
          follower_id: number
        }
        Insert: {
          created_at?: string
          follow_id?: number
          followee_id: number
          follower_id: number
        }
        Update: {
          created_at?: string
          follow_id?: number
          followee_id?: number
          follower_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "follows_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "follows_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "follows_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "follows_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "follows_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
        ]
      }
      job_applications: {
        Row: {
          applicant_email: string
          applicant_id: number
          applicant_name: string
          applicant_phone: string | null
          created_at: string
          custom_answers: Json
          id: string
          message: string | null
          opening_id: string
          rejection_reason: string | null
          status: string
        }
        Insert: {
          applicant_email: string
          applicant_id: number
          applicant_name: string
          applicant_phone?: string | null
          created_at?: string
          custom_answers?: Json
          id?: string
          message?: string | null
          opening_id: string
          rejection_reason?: string | null
          status?: string
        }
        Update: {
          applicant_email?: string
          applicant_id?: number
          applicant_name?: string
          applicant_phone?: string | null
          created_at?: string
          custom_answers?: Json
          id?: string
          message?: string | null
          opening_id?: string
          rejection_reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "job_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "job_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "job_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "job_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "job_applications_opening_id_fkey"
            columns: ["opening_id"]
            isOneToOne: false
            referencedRelation: "job_openings"
            referencedColumns: ["id"]
          },
        ]
      }
      job_openings: {
        Row: {
          category: string
          closed_at: string | null
          commitment: string | null
          created_at: string | null
          created_by_name: string
          created_by_role: string
          custom_questions: Json
          deadline: string | null
          deleted_at: string | null
          description: string
          id: string
          linked_post_id: string | null
          opening_id: number
          skills: string[] | null
          status: string | null
          team_id: number | null
          team_name: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category: string
          closed_at?: string | null
          commitment?: string | null
          created_at?: string | null
          created_by_name: string
          created_by_role: string
          custom_questions?: Json
          deadline?: string | null
          deleted_at?: string | null
          description: string
          id?: string
          linked_post_id?: string | null
          opening_id?: number
          skills?: string[] | null
          status?: string | null
          team_id?: number | null
          team_name?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          closed_at?: string | null
          commitment?: string | null
          created_at?: string | null
          created_by_name?: string
          created_by_role?: string
          custom_questions?: Json
          deadline?: string | null
          deleted_at?: string | null
          description?: string
          id?: string
          linked_post_id?: string | null
          opening_id?: number
          skills?: string[] | null
          status?: string | null
          team_id?: number | null
          team_name?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_openings_linked_post_id_fkey"
            columns: ["linked_post_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "job_openings_linked_post_id_fkey"
            columns: ["linked_post_id"]
            isOneToOne: false
            referencedRelation: "post_feed_view"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "job_openings_linked_post_id_fkey"
            columns: ["linked_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "job_openings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      legacy_volunteer_applications: {
        Row: {
          age: string | null
          availability: string | null
          college: string | null
          created_at: string | null
          email: string
          full_name: string
          id: number
          instagram_handle: string | null
          interests: string[] | null
          phone: string | null
          previous_experience: string | null
          status: string | null
          why_aquaterra: string
          year_of_study: string | null
        }
        Insert: {
          age?: string | null
          availability?: string | null
          college?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id?: number
          instagram_handle?: string | null
          interests?: string[] | null
          phone?: string | null
          previous_experience?: string | null
          status?: string | null
          why_aquaterra: string
          year_of_study?: string | null
        }
        Update: {
          age?: string | null
          availability?: string | null
          college?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: number
          instagram_handle?: string | null
          interests?: string[] | null
          phone?: string | null
          previous_experience?: string | null
          status?: string | null
          why_aquaterra?: string
          year_of_study?: string | null
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string | null
          like_id: number
          member_id: number
          post_id: number
        }
        Insert: {
          created_at?: string | null
          like_id?: number
          member_id: number
          post_id: number
        }
        Update: {
          created_at?: string | null
          like_id?: number
          member_id?: number
          post_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "likes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "likes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "likes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "likes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "likes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "post_feed_view"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["post_id"]
          },
        ]
      }
      member_activity: {
        Row: {
          actor_id: number | null
          created_at: string
          detail: Json
          id: number
          target_id: number
          verb: string
        }
        Insert: {
          actor_id?: number | null
          created_at?: string
          detail?: Json
          id?: never
          target_id: number
          verb: string
        }
        Update: {
          actor_id?: number | null
          created_at?: string
          detail?: Json
          id?: never
          target_id?: number
          verb?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "member_activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_activity_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_activity_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_activity_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_activity_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "member_activity_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
        ]
      }
      member_breaks: {
        Row: {
          created_at: string
          end: string
          id: number
          member_id: number
          note: string | null
          reason: string
          start: string
        }
        Insert: {
          created_at?: string
          end: string
          id?: never
          member_id: number
          note?: string | null
          reason: string
          start: string
        }
        Update: {
          created_at?: string
          end?: string
          id?: never
          member_id?: number
          note?: string | null
          reason?: string
          start?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_breaks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_breaks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_breaks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_breaks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "member_breaks_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
        ]
      }
      member_education: {
        Row: {
          created_at: string
          credential: string | null
          end_year: number | null
          grade: string | null
          id: number
          institution: string
          member_id: number
          start_year: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          credential?: string | null
          end_year?: number | null
          grade?: string | null
          id?: never
          institution: string
          member_id: number
          start_year?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          credential?: string | null
          end_year?: number | null
          grade?: string | null
          id?: never
          institution?: string
          member_id?: number
          start_year?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_education_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_education_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_education_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_education_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "member_education_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
        ]
      }
      member_of_the_month: {
        Row: {
          citation: string | null
          created_at: string
          id: number
          member_id: number
          period: string
          photo_uploaded_at: string | null
          photo_url: string | null
          picked_by: number | null
          team_id: number
          updated_at: string
        }
        Insert: {
          citation?: string | null
          created_at?: string
          id?: never
          member_id: number
          period: string
          photo_uploaded_at?: string | null
          photo_url?: string | null
          picked_by?: number | null
          team_id: number
          updated_at?: string
        }
        Update: {
          citation?: string | null
          created_at?: string
          id?: never
          member_id?: number
          period?: string
          photo_uploaded_at?: string | null
          photo_url?: string | null
          picked_by?: number | null
          team_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_of_the_month_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_of_the_month_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_of_the_month_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_of_the_month_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "member_of_the_month_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_of_the_month_picked_by_fkey"
            columns: ["picked_by"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_of_the_month_picked_by_fkey"
            columns: ["picked_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_of_the_month_picked_by_fkey"
            columns: ["picked_by"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_of_the_month_picked_by_fkey"
            columns: ["picked_by"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "member_of_the_month_picked_by_fkey"
            columns: ["picked_by"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_of_the_month_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      member_of_the_month_periods: {
        Row: {
          closed_at: string | null
          closed_by: number | null
          is_open: boolean
          opened_at: string | null
          opened_by: number | null
          period: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: number | null
          is_open?: boolean
          opened_at?: string | null
          opened_by?: number | null
          period: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: number | null
          is_open?: boolean
          opened_at?: string | null
          opened_by?: number | null
          period?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_of_the_month_periods_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_of_the_month_periods_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_of_the_month_periods_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_of_the_month_periods_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "member_of_the_month_periods_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_of_the_month_periods_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_of_the_month_periods_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_of_the_month_periods_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_of_the_month_periods_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "member_of_the_month_periods_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
        ]
      }
      member_preauth: {
        Row: {
          claimed_at: string | null
          claimed_by_member_id: number | null
          created_at: string
          email: string
          id: number
          import_batch: string | null
          intended_position: string | null
          intended_team_id: number | null
        }
        Insert: {
          claimed_at?: string | null
          claimed_by_member_id?: number | null
          created_at?: string
          email: string
          id?: never
          import_batch?: string | null
          intended_position?: string | null
          intended_team_id?: number | null
        }
        Update: {
          claimed_at?: string | null
          claimed_by_member_id?: number | null
          created_at?: string
          email?: string
          id?: never
          import_batch?: string | null
          intended_position?: string | null
          intended_team_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "member_preauth_claimed_by_member_id_fkey"
            columns: ["claimed_by_member_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_preauth_claimed_by_member_id_fkey"
            columns: ["claimed_by_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_preauth_claimed_by_member_id_fkey"
            columns: ["claimed_by_member_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_preauth_claimed_by_member_id_fkey"
            columns: ["claimed_by_member_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "member_preauth_claimed_by_member_id_fkey"
            columns: ["claimed_by_member_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "member_preauth_intended_team_id_fkey"
            columns: ["intended_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      members: {
        Row: {
          approved_at: string | null
          approved_by: number | null
          auth_uid: string | null
          avatar_url: string | null
          bio: string | null
          birthday: string | null
          birthday_public: boolean
          break_end: string | null
          break_reason: string | null
          break_start: string | null
          class_grade: string | null
          contacted_at: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: number | null
          email: string
          full_name: string
          google_id: string | null
          guardian_phone: string | null
          instagram: string | null
          is_active: boolean | null
          join_reason: string | null
          last_birthday_notice_year: number | null
          last_login: string | null
          linkedin: string | null
          member_id: number
          member_no: number | null
          phone: string | null
          previously_removed: boolean
          profile_nudge_dismiss_count: number
          profile_nudge_snoozed_until: string | null
          referred_by: number | null
          rejection_note: string | null
          role: string | null
          school_id: number | null
          status: string | null
          team_nudge_seen_at: string | null
          updated_at: string | null
          uuid: string
          wall_enabled: boolean
        }
        Insert: {
          approved_at?: string | null
          approved_by?: number | null
          auth_uid?: string | null
          avatar_url?: string | null
          bio?: string | null
          birthday?: string | null
          birthday_public?: boolean
          break_end?: string | null
          break_reason?: string | null
          break_start?: string | null
          class_grade?: string | null
          contacted_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: number | null
          email: string
          full_name: string
          google_id?: string | null
          guardian_phone?: string | null
          instagram?: string | null
          is_active?: boolean | null
          join_reason?: string | null
          last_birthday_notice_year?: number | null
          last_login?: string | null
          linkedin?: string | null
          member_id?: number
          member_no?: number | null
          phone?: string | null
          previously_removed?: boolean
          profile_nudge_dismiss_count?: number
          profile_nudge_snoozed_until?: string | null
          referred_by?: number | null
          rejection_note?: string | null
          role?: string | null
          school_id?: number | null
          status?: string | null
          team_nudge_seen_at?: string | null
          updated_at?: string | null
          uuid?: string
          wall_enabled?: boolean
        }
        Update: {
          approved_at?: string | null
          approved_by?: number | null
          auth_uid?: string | null
          avatar_url?: string | null
          bio?: string | null
          birthday?: string | null
          birthday_public?: boolean
          break_end?: string | null
          break_reason?: string | null
          break_start?: string | null
          class_grade?: string | null
          contacted_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: number | null
          email?: string
          full_name?: string
          google_id?: string | null
          guardian_phone?: string | null
          instagram?: string | null
          is_active?: boolean | null
          join_reason?: string | null
          last_birthday_notice_year?: number | null
          last_login?: string | null
          linkedin?: string | null
          member_id?: number
          member_no?: number | null
          phone?: string | null
          previously_removed?: boolean
          profile_nudge_dismiss_count?: number
          profile_nudge_snoozed_until?: string | null
          referred_by?: number | null
          rejection_note?: string | null
          role?: string | null
          school_id?: number | null
          status?: string | null
          team_nudge_seen_at?: string | null
          updated_at?: string | null
          uuid?: string
          wall_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "members_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "members_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "members_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "members_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["school_id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          full_note: string | null
          id: string
          is_read: boolean
          link: string | null
          member_id: number
          subtitle: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          full_note?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          member_id: number
          subtitle?: string | null
          title: string
          type: string
        }
        Update: {
          created_at?: string
          full_note?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          member_id?: number
          subtitle?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "notifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "notifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "notifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "notifications_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
        ]
      }
      points_ledger: {
        Row: {
          created_at: string
          created_by: number | null
          id: number
          member_id: number
          points: number
          reason: string
          related_drive_id: number | null
        }
        Insert: {
          created_at?: string
          created_by?: number | null
          id?: never
          member_id: number
          points: number
          reason: string
          related_drive_id?: number | null
        }
        Update: {
          created_at?: string
          created_by?: number | null
          id?: never
          member_id?: number
          points?: number
          reason?: string
          related_drive_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "points_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "points_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "points_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "points_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "points_ledger_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "points_ledger_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "points_ledger_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "points_ledger_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "points_ledger_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "points_ledger_related_drive_id_fkey"
            columns: ["related_drive_id"]
            isOneToOne: false
            referencedRelation: "welfare_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      post_approvals: {
        Row: {
          approval_id: number
          approved_at: string | null
          approved_by: number
          category: string
          post_id: number
        }
        Insert: {
          approval_id?: number
          approved_at?: string | null
          approved_by: number
          category: string
          post_id: number
        }
        Update: {
          approval_id?: number
          approved_at?: string | null
          approved_by?: number
          category?: string
          post_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_approvals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "post_approvals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "post_approvals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "post_approvals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "post_approvals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "post_approvals_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "post_approvals_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "post_feed_view"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "post_approvals_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["post_id"]
          },
        ]
      }
      post_categories: {
        Row: {
          category: string
          post_category_id: number
          post_id: number
        }
        Insert: {
          category: string
          post_category_id?: number
          post_id: number
        }
        Update: {
          category?: string
          post_category_id?: number
          post_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_categories_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "post_categories_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "post_feed_view"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "post_categories_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["post_id"]
          },
        ]
      }
      post_documents: {
        Row: {
          blob_name: string
          blob_url: string
          created_at: string
          display_order: number
          document_id: number
          file_name: string
          file_size: number
          mime_type: string
          post_id: number
        }
        Insert: {
          blob_name: string
          blob_url: string
          created_at?: string
          display_order?: number
          document_id?: number
          file_name: string
          file_size?: number
          mime_type: string
          post_id: number
        }
        Update: {
          blob_name?: string
          blob_url?: string
          created_at?: string
          display_order?: number
          document_id?: number
          file_name?: string
          file_size?: number
          mime_type?: string
          post_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_documents_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "post_documents_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "post_feed_view"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "post_documents_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["post_id"]
          },
        ]
      }
      post_images: {
        Row: {
          blob_name: string
          blob_url: string
          created_at: string | null
          display_order: number | null
          file_size: number | null
          image_id: number
          post_id: number
        }
        Insert: {
          blob_name: string
          blob_url: string
          created_at?: string | null
          display_order?: number | null
          file_size?: number | null
          image_id?: number
          post_id: number
        }
        Update: {
          blob_name?: string
          blob_url?: string
          created_at?: string | null
          display_order?: number | null
          file_size?: number | null
          image_id?: number
          post_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_images_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "post_images_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "post_feed_view"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "post_images_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["post_id"]
          },
        ]
      }
      post_tags: {
        Row: {
          created_at: string | null
          post_id: number
          tag_id: number
          tagged_member_id: number
        }
        Insert: {
          created_at?: string | null
          post_id: number
          tag_id?: number
          tagged_member_id: number
        }
        Update: {
          created_at?: string | null
          post_id?: number
          tag_id?: number
          tagged_member_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "post_feed_view"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "post_tags_tagged_member_id_fkey"
            columns: ["tagged_member_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "post_tags_tagged_member_id_fkey"
            columns: ["tagged_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "post_tags_tagged_member_id_fkey"
            columns: ["tagged_member_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "post_tags_tagged_member_id_fkey"
            columns: ["tagged_member_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "post_tags_tagged_member_id_fkey"
            columns: ["tagged_member_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
        ]
      }
      posts: {
        Row: {
          article: Json | null
          article_body: string | null
          author_id: number
          body: string
          category: string
          created_at: string | null
          deleted_at: string | null
          featured: boolean
          link_image: string | null
          link_title: string | null
          link_url: string | null
          pinned: boolean
          pinned_title: string | null
          post_id: number
          published_at: string | null
          rejection_note: string | null
          reviewed_at: string | null
          reviewed_by: number | null
          scheduled_for: string | null
          slug: string | null
          source_kind: string | null
          stats: Json
          status: string | null
          sub_team_id: number | null
          team_id: number | null
          title: string | null
          updated_at: string | null
          uuid: string
        }
        Insert: {
          article?: Json | null
          article_body?: string | null
          author_id: number
          body: string
          category: string
          created_at?: string | null
          deleted_at?: string | null
          featured?: boolean
          link_image?: string | null
          link_title?: string | null
          link_url?: string | null
          pinned?: boolean
          pinned_title?: string | null
          post_id?: number
          published_at?: string | null
          rejection_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: number | null
          scheduled_for?: string | null
          slug?: string | null
          source_kind?: string | null
          stats?: Json
          status?: string | null
          sub_team_id?: number | null
          team_id?: number | null
          title?: string | null
          updated_at?: string | null
          uuid?: string
        }
        Update: {
          article?: Json | null
          article_body?: string | null
          author_id?: number
          body?: string
          category?: string
          created_at?: string | null
          deleted_at?: string | null
          featured?: boolean
          link_image?: string | null
          link_title?: string | null
          link_url?: string | null
          pinned?: boolean
          pinned_title?: string | null
          post_id?: number
          published_at?: string | null
          rejection_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: number | null
          scheduled_for?: string | null
          slug?: string | null
          source_kind?: string | null
          stats?: Json
          status?: string | null
          sub_team_id?: number | null
          team_id?: number | null
          title?: string | null
          updated_at?: string | null
          uuid?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_posts_team"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "posts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "posts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "posts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "posts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "posts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "posts_sub_team_id_fkey"
            columns: ["sub_team_id"]
            isOneToOne: false
            referencedRelation: "sub_teams"
            referencedColumns: ["sub_team_id"]
          },
        ]
      }
      profile_notes: {
        Row: {
          author_uuid: string
          body: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          image_url: string | null
          label: string | null
          recipient_uuid: string
        }
        Insert: {
          author_uuid: string
          body: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          image_url?: string | null
          label?: string | null
          recipient_uuid: string
        }
        Update: {
          author_uuid?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          image_url?: string | null
          label?: string | null
          recipient_uuid?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_notes_author_uuid_fkey"
            columns: ["author_uuid"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "profile_notes_author_uuid_fkey"
            columns: ["author_uuid"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "profile_notes_author_uuid_fkey"
            columns: ["author_uuid"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "profile_notes_author_uuid_fkey"
            columns: ["author_uuid"]
            isOneToOne: false
            referencedRelation: "post_feed_view"
            referencedColumns: ["author_uuid"]
          },
          {
            foreignKeyName: "profile_notes_author_uuid_fkey"
            columns: ["author_uuid"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "profile_notes_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "profile_notes_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "profile_notes_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "profile_notes_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "post_feed_view"
            referencedColumns: ["author_uuid"]
          },
          {
            foreignKeyName: "profile_notes_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "profile_notes_recipient_uuid_fkey"
            columns: ["recipient_uuid"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "profile_notes_recipient_uuid_fkey"
            columns: ["recipient_uuid"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "profile_notes_recipient_uuid_fkey"
            columns: ["recipient_uuid"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "profile_notes_recipient_uuid_fkey"
            columns: ["recipient_uuid"]
            isOneToOne: false
            referencedRelation: "post_feed_view"
            referencedColumns: ["author_uuid"]
          },
          {
            foreignKeyName: "profile_notes_recipient_uuid_fkey"
            columns: ["recipient_uuid"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["uuid"]
          },
        ]
      }
      referral_clicks: {
        Row: {
          created_at: string
          id: number
          referral_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          referral_id: string
        }
        Update: {
          created_at?: string
          id?: never
          referral_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_clicks_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          note: string | null
          opening_id: number | null
          referrer_id: number
          status: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          opening_id?: number | null
          referrer_id: number
          status?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          opening_id?: number | null
          referrer_id?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_opening_id_fkey"
            columns: ["opening_id"]
            isOneToOne: false
            referencedRelation: "job_openings"
            referencedColumns: ["opening_id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
        ]
      }
      role_capabilities: {
        Row: {
          capability_key: string
          enabled: boolean
          role: string
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          capability_key: string
          enabled?: boolean
          role: string
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          capability_key?: string
          enabled?: boolean
          role?: string
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "role_capabilities_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "role_capabilities_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "role_capabilities_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "role_capabilities_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "role_capabilities_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
        ]
      }
      role_capability_notes: {
        Row: {
          capability_area: string
          created_at: string
          description: string
          display_order: number
          id: number
          role: string
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          capability_area: string
          created_at?: string
          description: string
          display_order?: number
          id?: never
          role: string
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          capability_area?: string
          created_at?: string
          description?: string
          display_order?: number
          id?: never
          role?: string
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "role_capability_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "role_capability_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "role_capability_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "role_capability_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "role_capability_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
        ]
      }
      saved_posts: {
        Row: {
          created_at: string
          member_id: number
          post_id: number
          saved_id: number
        }
        Insert: {
          created_at?: string
          member_id: number
          post_id: number
          saved_id?: number
        }
        Update: {
          created_at?: string
          member_id?: number
          post_id?: number
          saved_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "saved_posts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "saved_posts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "saved_posts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "saved_posts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "post_feed_view"
            referencedColumns: ["post_id"]
          },
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["post_id"]
          },
        ]
      }
      schools: {
        Row: {
          created_at: string
          location: string | null
          logo_url: string | null
          name: string
          school_id: number
          short_name: string | null
          updated_at: string
          uuid: string
          website: string | null
        }
        Insert: {
          created_at?: string
          location?: string | null
          logo_url?: string | null
          name: string
          school_id?: number
          short_name?: string | null
          updated_at?: string
          uuid?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          location?: string | null
          logo_url?: string | null
          name?: string
          school_id?: number
          short_name?: string | null
          updated_at?: string
          uuid?: string
          website?: string | null
        }
        Relationships: []
      }
      sim_seed_registry: {
        Row: {
          created_at: string
          del_order: number
          id: number
          pk_text: string
          tbl: string
        }
        Insert: {
          created_at?: string
          del_order?: number
          id?: number
          pk_text: string
          tbl: string
        }
        Update: {
          created_at?: string
          del_order?: number
          id?: number
          pk_text?: string
          tbl?: string
        }
        Relationships: []
      }
      sop_templates: {
        Row: {
          body: string
          department_slug: string
          id: number
          label: string
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          body: string
          department_slug: string
          id?: never
          label: string
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          body?: string
          department_slug?: string
          id?: never
          label?: string
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sop_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "sop_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "sop_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "sop_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "sop_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
        ]
      }
      sops: {
        Row: {
          assigned_on: string | null
          completed_on: string | null
          created_at: string
          department_slug: string
          description: string | null
          doc_links: string[] | null
          due_on: string | null
          id: number
          kind: string
          last_run_at: string | null
          led_by_member_id: number | null
          led_by_text: string
          notes: string | null
          status: string
          sub_division: string | null
          task: string
          updated_at: string
          urgency: string | null
        }
        Insert: {
          assigned_on?: string | null
          completed_on?: string | null
          created_at?: string
          department_slug: string
          description?: string | null
          doc_links?: string[] | null
          due_on?: string | null
          id?: never
          kind: string
          last_run_at?: string | null
          led_by_member_id?: number | null
          led_by_text: string
          notes?: string | null
          status?: string
          sub_division?: string | null
          task: string
          updated_at?: string
          urgency?: string | null
        }
        Update: {
          assigned_on?: string | null
          completed_on?: string | null
          created_at?: string
          department_slug?: string
          description?: string | null
          doc_links?: string[] | null
          due_on?: string | null
          id?: never
          kind?: string
          last_run_at?: string | null
          led_by_member_id?: number | null
          led_by_text?: string
          notes?: string | null
          status?: string
          sub_division?: string | null
          task?: string
          updated_at?: string
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sops_led_by_member_id_fkey"
            columns: ["led_by_member_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "sops_led_by_member_id_fkey"
            columns: ["led_by_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "sops_led_by_member_id_fkey"
            columns: ["led_by_member_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "sops_led_by_member_id_fkey"
            columns: ["led_by_member_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "sops_led_by_member_id_fkey"
            columns: ["led_by_member_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
        ]
      }
      sub_teams: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          is_active: boolean
          name: string
          slug: string
          sub_team_id: number
          team_id: number
          uuid: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          is_active?: boolean
          name: string
          slug: string
          sub_team_id?: number
          team_id: number
          uuid?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          is_active?: boolean
          name?: string
          slug?: string
          sub_team_id?: number
          team_id?: number
          uuid?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      team_follows: {
        Row: {
          created_at: string
          follow_id: number
          follower_id: number
          team_id: number
        }
        Insert: {
          created_at?: string
          follow_id?: never
          follower_id: number
          team_id: number
        }
        Update: {
          created_at?: string
          follow_id?: never
          follower_id?: number
          team_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "team_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "team_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "team_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "team_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "team_follows_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      team_join_requests: {
        Row: {
          created_at: string | null
          member_id: number
          message: string | null
          request_id: number
          reviewed_at: string | null
          reviewed_by: number | null
          status: string | null
          team_id: number
          updated_at: string | null
          uuid: string
        }
        Insert: {
          created_at?: string | null
          member_id: number
          message?: string | null
          request_id?: number
          reviewed_at?: string | null
          reviewed_by?: number | null
          status?: string | null
          team_id: number
          updated_at?: string | null
          uuid?: string
        }
        Update: {
          created_at?: string | null
          member_id?: number
          message?: string | null
          request_id?: number
          reviewed_at?: string | null
          reviewed_by?: number | null
          status?: string | null
          team_id?: number
          updated_at?: string | null
          uuid?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_join_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "team_join_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "team_join_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "team_join_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "team_join_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "team_join_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "team_join_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "team_join_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "team_join_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "team_join_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "team_join_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      team_member_sub_teams: {
        Row: {
          created_at: string
          id: number
          sub_team_id: number
          team_member_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          sub_team_id: number
          team_member_id: number
        }
        Update: {
          created_at?: string
          id?: number
          sub_team_id?: number
          team_member_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_member_sub_teams_sub_team_id_fkey"
            columns: ["sub_team_id"]
            isOneToOne: false
            referencedRelation: "sub_teams"
            referencedColumns: ["sub_team_id"]
          },
          {
            foreignKeyName: "team_member_sub_teams_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["team_member_id"]
          },
        ]
      }
      team_members: {
        Row: {
          is_active: boolean | null
          joined_at: string | null
          left_at: string | null
          member_id: number
          role: string | null
          sub_team: string | null
          team_id: number
          team_member_id: number
        }
        Insert: {
          is_active?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          member_id: number
          role?: string | null
          sub_team?: string | null
          team_id: number
          team_member_id?: number
        }
        Update: {
          is_active?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          member_id?: number
          role?: string | null
          sub_team?: string | null
          team_id?: number
          team_member_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "team_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "team_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "team_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "team_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      teams: {
        Row: {
          banner_url: string | null
          category: string | null
          created_at: string | null
          created_by: number | null
          description: string | null
          is_active: boolean | null
          logo_url: string | null
          name: string
          parent_team_id: number | null
          skills: string[]
          team_id: number
          updated_at: string | null
          uuid: string
        }
        Insert: {
          banner_url?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: number | null
          description?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          parent_team_id?: number | null
          skills?: string[]
          team_id?: number
          updated_at?: string | null
          uuid?: string
        }
        Update: {
          banner_url?: string | null
          category?: string
          created_at?: string | null
          created_by?: number | null
          description?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          parent_team_id?: number | null
          skills?: string[]
          team_id?: number
          updated_at?: string | null
          uuid?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
        ]
      }
      volunteer_applications: {
        Row: {
          added: boolean
          age: number | null
          availability: string | null
          college: string | null
          created_at: string | null
          email: string
          full_name: string
          id: number
          instagram_handle: string | null
          interests: string[] | null
          phone: string | null
          previous_experience: string | null
          review_note: string | null
          reviewed: boolean | null
          texted: boolean
          texted_by: string | null
          vol_label: string | null
          why_aquaterra: string
          year_of_study: string | null
        }
        Insert: {
          added?: boolean
          age?: number | null
          availability?: string | null
          college?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id?: number
          instagram_handle?: string | null
          interests?: string[] | null
          phone?: string | null
          previous_experience?: string | null
          review_note?: string | null
          reviewed?: boolean | null
          texted?: boolean
          texted_by?: string | null
          vol_label?: string | null
          why_aquaterra: string
          year_of_study?: string | null
        }
        Update: {
          added?: boolean
          age?: number | null
          availability?: string | null
          college?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: number
          instagram_handle?: string | null
          interests?: string[] | null
          phone?: string | null
          previous_experience?: string | null
          review_note?: string | null
          reviewed?: boolean | null
          texted?: boolean
          texted_by?: string | null
          vol_label?: string | null
          why_aquaterra?: string
          year_of_study?: string | null
        }
        Relationships: []
      }
      welfare_projects: {
        Row: {
          attendance_completed_at: string | null
          category: string
          collab_logo: string | null
          collab_logo_alt: string | null
          collab_name: string | null
          created_at: string | null
          drive_lead_member_id: number | null
          featured: boolean | null
          google_drive_link: string | null
          header: string
          id: number
          image_1: string | null
          image_1_alt: string | null
          image_2: string | null
          image_2_alt: string | null
          image_3: string | null
          image_3_alt: string | null
          image_4: string | null
          image_4_alt: string | null
          instagram_link: string | null
          is_draft: boolean | null
          key_statistic: string | null
          label_1: string | null
          label_2: string | null
          label_3: string | null
          label_4: string | null
          linked_post_id: string | null
          location: string | null
          long_writeup: string | null
          main_image: string | null
          main_image_alt: string | null
          objective: string | null
          scheduled_end: string | null
          short_summary: string | null
          slug: string
          status: string | null
          team_id: number | null
          volunteers: number | null
          workshop_date: string | null
        }
        Insert: {
          attendance_completed_at?: string | null
          category?: string
          collab_logo?: string | null
          collab_logo_alt?: string | null
          collab_name?: string | null
          created_at?: string | null
          drive_lead_member_id?: number | null
          featured?: boolean | null
          google_drive_link?: string | null
          header: string
          id?: number
          image_1?: string | null
          image_1_alt?: string | null
          image_2?: string | null
          image_2_alt?: string | null
          image_3?: string | null
          image_3_alt?: string | null
          image_4?: string | null
          image_4_alt?: string | null
          instagram_link?: string | null
          is_draft?: boolean | null
          key_statistic?: string | null
          label_1?: string | null
          label_2?: string | null
          label_3?: string | null
          label_4?: string | null
          linked_post_id?: string | null
          location?: string | null
          long_writeup?: string | null
          main_image?: string | null
          main_image_alt?: string | null
          objective?: string | null
          scheduled_end?: string | null
          short_summary?: string | null
          slug: string
          status?: string | null
          team_id?: number | null
          volunteers?: number | null
          workshop_date?: string | null
        }
        Update: {
          attendance_completed_at?: string | null
          category?: string
          collab_logo?: string | null
          collab_logo_alt?: string | null
          collab_name?: string | null
          created_at?: string | null
          drive_lead_member_id?: number | null
          featured?: boolean | null
          google_drive_link?: string | null
          header?: string
          id?: number
          image_1?: string | null
          image_1_alt?: string | null
          image_2?: string | null
          image_2_alt?: string | null
          image_3?: string | null
          image_3_alt?: string | null
          image_4?: string | null
          image_4_alt?: string | null
          instagram_link?: string | null
          is_draft?: boolean | null
          key_statistic?: string | null
          label_1?: string | null
          label_2?: string | null
          label_3?: string | null
          label_4?: string | null
          linked_post_id?: string | null
          location?: string | null
          long_writeup?: string | null
          main_image?: string | null
          main_image_alt?: string | null
          objective?: string | null
          scheduled_end?: string | null
          short_summary?: string | null
          slug?: string
          status?: string | null
          team_id?: number | null
          volunteers?: number | null
          workshop_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "welfare_projects_drive_lead_member_id_fkey"
            columns: ["drive_lead_member_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "welfare_projects_drive_lead_member_id_fkey"
            columns: ["drive_lead_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "welfare_projects_drive_lead_member_id_fkey"
            columns: ["drive_lead_member_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "welfare_projects_drive_lead_member_id_fkey"
            columns: ["drive_lead_member_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "welfare_projects_drive_lead_member_id_fkey"
            columns: ["drive_lead_member_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "welfare_projects_linked_post_id_fkey"
            columns: ["linked_post_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "welfare_projects_linked_post_id_fkey"
            columns: ["linked_post_id"]
            isOneToOne: false
            referencedRelation: "post_feed_view"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "welfare_projects_linked_post_id_fkey"
            columns: ["linked_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "welfare_projects_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      wishes: {
        Row: {
          author_id: number
          body: string
          created_at: string
          id: number
          member_id: number
          year: number
        }
        Insert: {
          author_id: number
          body: string
          created_at?: string
          id?: never
          member_id: number
          year: number
        }
        Update: {
          author_id?: number
          body?: string
          created_at?: string
          id?: never
          member_id?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "wishes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "wishes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "wishes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "wishes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "wishes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "wishes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "wishes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "wishes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "wishes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "wishes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
        ]
      }
      yearbook_entries: {
        Row: {
          created_at: string
          edition_year: number
          id: number
          invited_at: string
          invited_by: number | null
          member_id: number
          photo_url: string | null
          quote: string | null
          status: string
          submitted_at: string | null
          use_own_avatar: boolean
        }
        Insert: {
          created_at?: string
          edition_year: number
          id?: never
          invited_at?: string
          invited_by?: number | null
          member_id: number
          photo_url?: string | null
          quote?: string | null
          status?: string
          submitted_at?: string | null
          use_own_avatar?: boolean
        }
        Update: {
          created_at?: string
          edition_year?: number
          id?: never
          invited_at?: string
          invited_by?: number | null
          member_id?: number
          photo_url?: string | null
          quote?: string | null
          status?: string
          submitted_at?: string | null
          use_own_avatar?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "yearbook_entries_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "yearbook_entries_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "yearbook_entries_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "yearbook_entries_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "yearbook_entries_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "yearbook_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "yearbook_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "yearbook_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "yearbook_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "yearbook_entries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
        ]
      }
    }
    Views: {
      member_directory_view: {
        Row: {
          avatar_url: string | null
          break_end: string | null
          class_grade: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          instagram: string | null
          is_active: boolean | null
          linkedin: string | null
          member_id: number | null
          phone: string | null
          role: string | null
          role_rank: number | null
          school_name: string | null
          status: string | null
          uuid: string | null
        }
        Relationships: []
      }
      pending_member_approvals: {
        Row: {
          avatar_url: string | null
          bio: string | null
          class_grade: string | null
          contacted_at: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          join_reason: string | null
          member_id: number | null
          phone: string | null
          previously_removed: boolean | null
          uuid: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          class_grade?: string | null
          contacted_at?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          join_reason?: string | null
          member_id?: number | null
          phone?: string | null
          previously_removed?: boolean | null
          uuid?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          class_grade?: string | null
          contacted_at?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          join_reason?: string | null
          member_id?: number | null
          phone?: string | null
          previously_removed?: boolean | null
          uuid?: string | null
        }
        Relationships: []
      }
      pending_post_reviews: {
        Row: {
          author_avatar: string | null
          author_id: number | null
          author_name: string | null
          body: string | null
          category: string | null
          created_at: string | null
          link_url: string | null
          post_id: number | null
          uuid: string | null
        }
        Relationships: []
      }
      post_feed_view: {
        Row: {
          article_body: string | null
          author_avatar: string | null
          author_id: number | null
          author_name: string | null
          author_role: string | null
          author_uuid: string | null
          body: string | null
          category: string | null
          comment_count: number | null
          created_at: string | null
          featured: boolean | null
          images: Json | null
          like_count: number | null
          link_image: string | null
          link_title: string | null
          link_url: string | null
          pinned: boolean | null
          pinned_title: string | null
          post_id: number | null
          scheduled_for: string | null
          source_author: string | null
          source_date: string | null
          source_kind: string | null
          source_location: string | null
          source_read_minutes: number | null
          source_slug: string | null
          source_stat: string | null
          source_summary: string | null
          source_title: string | null
          source_type: string | null
          stats: Json | null
          status: string | null
          sub_team_name: string | null
          sub_team_uuid: string | null
          tagged_members: Json | null
          team_name: string | null
          team_uuid: string | null
          updated_at: string | null
          uuid: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "member_directory_view"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "pending_member_approvals"
            referencedColumns: ["member_id"]
          },
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "pending_post_reviews"
            referencedColumns: ["author_id"]
          },
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "rejected_member_approvals"
            referencedColumns: ["member_id"]
          },
        ]
      }
      rejected_member_approvals: {
        Row: {
          avatar_url: string | null
          class_grade: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          join_reason: string | null
          member_id: number | null
          phone: string | null
          rejection_note: string | null
          updated_at: string | null
          uuid: string | null
        }
        Insert: {
          avatar_url?: string | null
          class_grade?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          join_reason?: string | null
          member_id?: number | null
          phone?: string | null
          rejection_note?: string | null
          updated_at?: string | null
          uuid?: string | null
        }
        Update: {
          avatar_url?: string | null
          class_grade?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          join_reason?: string | null
          member_id?: number | null
          phone?: string | null
          rejection_note?: string | null
          updated_at?: string | null
          uuid?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      appeal_removed_account: { Args: never; Returns: undefined }
      approve_post_category: {
        Args: { p_category: string; p_post_uuid: string }
        Returns: Json
      }
      blog_post_writeup: {
        Args: { body: string; headliner: string; written_by: string }
        Returns: string
      }
      can_pick_mom_for_team: { Args: { p_team_id: number }; Returns: boolean }
      claim_member_preauth: {
        Args: never
        Returns: {
          intended_position: string
          intended_team_id: number
        }[]
      }
      claim_member_referral: {
        Args: { p_referral_id: string }
        Returns: boolean
      }
      complete_drive_attendance: {
        Args: { p_welfare_project_id: number }
        Returns: {
          already_completed: boolean
          attendees_paid: number
        }[]
      }
      create_birthday_notice: {
        Args: never
        Returns: {
          created: boolean
          post_uuid: string
        }[]
      }
      create_notification: {
        Args: {
          p_full_note?: string
          p_link?: string
          p_member_id: number
          p_subtitle?: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      create_post_as_org: {
        Args: {
          p_body: string
          p_category: string
          p_document_urls?: Json
          p_image_urls?: string[]
          p_link_image?: string
          p_link_title?: string
          p_link_url?: string
          p_scheduled_for?: string
          p_stats?: Json
          p_status?: string
          p_tagged_member_ids?: number[]
        }
        Returns: {
          post_id: number
          uuid: string
        }[]
      }
      current_member_id: { Args: never; Returns: number }
      current_member_uuid: { Args: never; Returns: string }
      ensure_member: { Args: never; Returns: undefined }
      format_blog_body: { Args: { src: string }; Returns: string }
      get_aq_contacts: {
        Args: { p_limit?: number; p_offset?: number; p_search?: string }
        Returns: {
          class_grade: string
          email: string
          full_name: string
          id: number
          instagram: string
          matched_member_id: number
          phone_raw: string
          points_note: string
          school: string
          source_sheet: string
        }[]
      }
      get_current_member_id: { Args: never; Returns: number }
      get_own_member: {
        Args: never
        Returns: {
          approved_at: string | null
          approved_by: number | null
          auth_uid: string | null
          avatar_url: string | null
          bio: string | null
          birthday: string | null
          birthday_public: boolean
          break_end: string | null
          break_reason: string | null
          break_start: string | null
          class_grade: string | null
          contacted_at: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: number | null
          email: string
          full_name: string
          google_id: string | null
          guardian_phone: string | null
          instagram: string | null
          is_active: boolean | null
          join_reason: string | null
          last_birthday_notice_year: number | null
          last_login: string | null
          linkedin: string | null
          member_id: number
          member_no: number | null
          phone: string | null
          previously_removed: boolean
          profile_nudge_dismiss_count: number
          profile_nudge_snoozed_until: string | null
          referred_by: number | null
          rejection_note: string | null
          role: string | null
          school_id: number | null
          status: string | null
          team_nudge_seen_at: string | null
          updated_at: string | null
          uuid: string
          wall_enabled: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "members"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_team_member_contacts: {
        Args: { p_member_ids: number[]; p_team_id: number }
        Returns: {
          email: string
          member_id: number
          phone: string
        }[]
      }
      hr_set_member_break: {
        Args: {
          p_end: string
          p_member_id: number
          p_note?: string
          p_reason: string
          p_start: string
        }
        Returns: undefined
      }
      is_assigned_to_category: { Args: { cat: string }; Returns: boolean }
      is_director: { Args: never; Returns: boolean }
      is_director_for_category: {
        Args: { p_category: string }
        Returns: boolean
      }
      is_lead_of_member: { Args: { p_member_id: number }; Returns: boolean }
      is_member_of_department: { Args: { p_slug: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_team_lead: { Args: { p_team_id: number }; Returns: boolean }
      is_team_lead_of_member: {
        Args: { p_member_id: number }
        Returns: boolean
      }
      log_action: {
        Args: {
          p_action: string
          p_details?: Json
          p_entity_id?: number
          p_entity_type?: string
        }
        Returns: undefined
      }
      mom_period_is_open: { Args: { p_period: string }; Returns: boolean }
      mom_target_is_active_member: {
        Args: { p_member_id: number }
        Returns: boolean
      }
      mom_target_on_team: {
        Args: { p_member_id: number; p_team_id: number }
        Returns: boolean
      }
      publish_due_scheduled_posts: { Args: never; Returns: number }
      purge_old_deleted_profile_notes: { Args: never; Returns: number }
      restart_member_as_applicant: {
        Args: { p_member_id: number }
        Returns: undefined
      }
      restore_member: { Args: { p_member_id: number }; Returns: undefined }
      role_can: { Args: { p_key: string }; Returns: boolean }
      sim_seed_teardown: {
        Args: never
        Returns: {
          rows_deleted: number
          tbl: string
        }[]
      }
      soft_delete_member: { Args: { p_member_id: number }; Returns: undefined }
      submit_mom_photo: {
        Args: { p_photo_url: string; p_pick_id: number }
        Returns: {
          citation: string | null
          created_at: string
          id: number
          member_id: number
          period: string
          photo_uploaded_at: string | null
          photo_url: string | null
          picked_by: number | null
          team_id: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "member_of_the_month"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_drive_post_stats: {
        Args: { p_stats: Json; p_welfare_project_id: number }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
