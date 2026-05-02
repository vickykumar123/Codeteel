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
      chat_summaries: {
        Row: {
          conversation_id: string
          created_at: string | null
          last_message_id: string
          summary: string
          tokens_compressed: number
          updated_at: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          last_message_id: string
          summary: string
          tokens_compressed?: number
          updated_at?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          last_message_id?: string
          summary?: string
          tokens_compressed?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_summaries_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_summaries_last_message_id_fkey"
            columns: ["last_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          execution_state: Json | null
          id: string
          is_processing: boolean | null
          platform: string | null
          platform_metadata: Json | null
          repo_id: string
          task_id: string | null
          title: string | null
          updated_at: string | null
          user_id: string
          working_branch: string | null
        }
        Insert: {
          created_at?: string | null
          execution_state?: Json | null
          id?: string
          is_processing?: boolean | null
          platform?: string | null
          platform_metadata?: Json | null
          repo_id: string
          task_id?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
          working_branch?: string | null
        }
        Update: {
          created_at?: string | null
          execution_state?: Json | null
          id?: string
          is_processing?: boolean | null
          platform?: string | null
          platform_metadata?: Json | null
          repo_id?: string
          task_id?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
          working_branch?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_repo_id_fkey"
            columns: ["repo_id"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      file_summaries: {
        Row: {
          code: string | null
          content_hash: string | null
          created_at: string | null
          id: string
          language: string | null
          last_author: string | null
          last_commit_sha: string | null
          path: string
          repo_id: string
          size: number | null
          summary: string | null
          summary_embedding: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          content_hash?: string | null
          created_at?: string | null
          id?: string
          language?: string | null
          last_author?: string | null
          last_commit_sha?: string | null
          path: string
          repo_id: string
          size?: number | null
          summary?: string | null
          summary_embedding?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          content_hash?: string | null
          created_at?: string | null
          id?: string
          language?: string | null
          last_author?: string | null
          last_commit_sha?: string | null
          path?: string
          repo_id?: string
          size?: number | null
          summary?: string | null
          summary_embedding?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "file_summaries_repo_id_fkey"
            columns: ["repo_id"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["id"]
          },
        ]
      }
      index_jobs: {
        Row: {
          completed_at: string | null
          completed_paths: string[] | null
          created_at: string | null
          current_batch: number | null
          error_message: string | null
          failed_files: number | null
          failed_paths: Json | null
          file_list: Json | null
          id: string
          processed_files: number | null
          repo_id: string
          status: string | null
          total_batches: number | null
          total_files: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_paths?: string[] | null
          created_at?: string | null
          current_batch?: number | null
          error_message?: string | null
          failed_files?: number | null
          failed_paths?: Json | null
          file_list?: Json | null
          id?: string
          processed_files?: number | null
          repo_id: string
          status?: string | null
          total_batches?: number | null
          total_files?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_paths?: string[] | null
          created_at?: string | null
          current_batch?: number | null
          error_message?: string | null
          failed_files?: number | null
          failed_paths?: Json | null
          file_list?: Json | null
          id?: string
          processed_files?: number | null
          repo_id?: string
          status?: string | null
          total_batches?: number | null
          total_files?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "index_jobs_repo_id_fkey"
            columns: ["repo_id"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "index_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_providers: {
        Row: {
          api_key: string | null
          base_url: string
          created_at: string | null
          id: string
          is_active: boolean | null
          model: string
          provider: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          api_key?: string | null
          base_url: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          model: string
          provider: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          api_key?: string | null
          base_url?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          model?: string
          provider?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "llm_providers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
          tool_call_id: string | null
          tool_calls: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
          tool_call_id?: string | null
          tool_calls?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          tool_call_id?: string | null
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      messaging_connections: {
        Row: {
          bot_token: string | null
          channel_id: string | null
          created_at: string | null
          id: string
          platform: string
          settings: Json | null
          user_id: string
          workspace_id: string | null
          workspace_name: string | null
        }
        Insert: {
          bot_token?: string | null
          channel_id?: string | null
          created_at?: string | null
          id?: string
          platform: string
          settings?: Json | null
          user_id: string
          workspace_id?: string | null
          workspace_name?: string | null
        }
        Update: {
          bot_token?: string | null
          channel_id?: string | null
          created_at?: string | null
          id?: string
          platform?: string
          settings?: Json | null
          user_id?: string
          workspace_id?: string | null
          workspace_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messaging_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_connect_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          platform: string
          repo_id: string
          token: string
          used: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          platform?: string
          repo_id: string
          token: string
          used?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          platform?: string
          repo_id?: string
          token?: string
          used?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_connect_tokens_repo_id_fkey"
            columns: ["repo_id"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_connections: {
        Row: {
          access_token: string | null
          created_at: string | null
          id: string
          platform: string
          platform_channel_id: string
          platform_team_id: string | null
          platform_user_id: string
          repo_id: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          id?: string
          platform: string
          platform_channel_id: string
          platform_team_id?: string | null
          platform_user_id: string
          repo_id: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          id?: string
          platform?: string
          platform_channel_id?: string
          platform_team_id?: string | null
          platform_user_id?: string
          repo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_connections_repo_id_fkey"
            columns: ["repo_id"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_llm_providers: {
        Row: {
          api_key: string
          base_url: string
          created_at: string | null
          id: string
          is_active: boolean | null
          model: string
          provider: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          api_key: string
          base_url: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          model: string
          provider: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          api_key?: string
          base_url?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          model?: string
          provider?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      repositories: {
        Row: {
          change_detection_branch: string | null
          created_at: string | null
          default_branch: string | null
          file_count: number | null
          framework: string | null
          full_name: string
          github_id: string
          id: string
          index_status: string | null
          indexed_at: string | null
          indexed_commit_sha: string | null
          instructions: string | null
          languages: Json | null
          last_indexed_commit: string | null
          name: string
          pending_changes: Json | null
          private: boolean | null
          settings: Json | null
          updated_at: string | null
          user_id: string
          webhook_id: number | null
        }
        Insert: {
          change_detection_branch?: string | null
          created_at?: string | null
          default_branch?: string | null
          file_count?: number | null
          framework?: string | null
          full_name: string
          github_id: string
          id?: string
          index_status?: string | null
          indexed_at?: string | null
          indexed_commit_sha?: string | null
          instructions?: string | null
          languages?: Json | null
          last_indexed_commit?: string | null
          name: string
          pending_changes?: Json | null
          private?: boolean | null
          settings?: Json | null
          updated_at?: string | null
          user_id: string
          webhook_id?: number | null
        }
        Update: {
          change_detection_branch?: string | null
          created_at?: string | null
          default_branch?: string | null
          file_count?: number | null
          framework?: string | null
          full_name?: string
          github_id?: string
          id?: string
          index_status?: string | null
          indexed_at?: string | null
          indexed_commit_sha?: string | null
          instructions?: string | null
          languages?: Json | null
          last_indexed_commit?: string | null
          name?: string
          pending_changes?: Json | null
          private?: boolean | null
          settings?: Json | null
          updated_at?: string | null
          user_id?: string
          webhook_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "repositories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      slack_installations: {
        Row: {
          bot_token: string
          bot_user_id: string | null
          id: string
          installed_at: string | null
          team_id: string
          team_name: string | null
          user_id: string
        }
        Insert: {
          bot_token: string
          bot_user_id?: string | null
          id?: string
          installed_at?: string | null
          team_id: string
          team_name?: string | null
          user_id: string
        }
        Update: {
          bot_token?: string
          bot_user_id?: string | null
          id?: string
          installed_at?: string | null
          team_id?: string
          team_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          branch_name: string | null
          created_at: string | null
          execution_completed_at: string | null
          execution_error: string | null
          execution_started_at: string | null
          execution_status: string | null
          files_changed: Json | null
          id: string
          intent: string | null
          plan: Json | null
          plan_approved_at: string | null
          plan_feedback: string | null
          plan_status: string | null
          pr_number: number | null
          pr_url: string | null
          repo_id: string
          request_text: string
          source: string
          source_channel_id: string | null
          source_message_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          branch_name?: string | null
          created_at?: string | null
          execution_completed_at?: string | null
          execution_error?: string | null
          execution_started_at?: string | null
          execution_status?: string | null
          files_changed?: Json | null
          id?: string
          intent?: string | null
          plan?: Json | null
          plan_approved_at?: string | null
          plan_feedback?: string | null
          plan_status?: string | null
          pr_number?: number | null
          pr_url?: string | null
          repo_id: string
          request_text: string
          source: string
          source_channel_id?: string | null
          source_message_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          branch_name?: string | null
          created_at?: string | null
          execution_completed_at?: string | null
          execution_error?: string | null
          execution_started_at?: string | null
          execution_status?: string | null
          files_changed?: Json | null
          id?: string
          intent?: string | null
          plan?: Json | null
          plan_approved_at?: string | null
          plan_feedback?: string | null
          plan_status?: string | null
          pr_number?: number | null
          pr_url?: string | null
          repo_id?: string
          request_text?: string
          source?: string
          source_channel_id?: string | null
          source_message_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_repo_id_fkey"
            columns: ["repo_id"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      team_instructions: {
        Row: {
          created_at: string | null
          id: string
          instructions: string
          team_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          instructions: string
          team_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          instructions?: string
          team_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          custom_instructions: string | null
          email: string
          embedding_api_key: string | null
          embedding_model: string | null
          embedding_provider: string | null
          github_access_token: string | null
          github_id: string | null
          id: string
          name: string | null
          settings: Json | null
          slack_user_id: string | null
          telegram_user_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          custom_instructions?: string | null
          email: string
          embedding_api_key?: string | null
          embedding_model?: string | null
          embedding_provider?: string | null
          github_access_token?: string | null
          github_id?: string | null
          id: string
          name?: string | null
          settings?: Json | null
          slack_user_id?: string | null
          telegram_user_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          custom_instructions?: string | null
          email?: string
          embedding_api_key?: string | null
          embedding_model?: string | null
          embedding_provider?: string | null
          github_access_token?: string | null
          github_id?: string | null
          id?: string
          name?: string | null
          settings?: Json | null
          slack_user_id?: string | null
          telegram_user_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      append_pending_changes: {
        Args: { p_changes: Json; p_repo_id: string }
        Returns: undefined
      }
      grep_files: {
        Args: {
          p_context_lines?: number
          p_file_pattern?: string
          p_is_regex?: boolean
          p_limit?: number
          p_pattern: string
          p_repo_id: string
        }
        Returns: {
          file_language: string
          file_path: string
          is_match: boolean
          line_content: string
          line_number: number
          match_group: number
        }[]
      }
      search_files_semantic: {
        Args: { p_embedding: string; p_limit?: number; p_repo_id: string }
        Returns: {
          id: string
          path: string
          similarity: number
          summary: string
        }[]
      }
      search_files_text: {
        Args: { p_limit?: number; p_query: string; p_repo_id: string }
        Returns: {
          code: string
          id: string
          language: string
          path: string
          similarity: number
          summary: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
