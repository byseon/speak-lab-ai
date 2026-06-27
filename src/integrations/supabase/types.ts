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
      assessment_results: {
        Row: {
          coaching: Json
          created_at: string
          fluency_band: number | null
          grammar_band: number | null
          id: string
          lexical_band: number | null
          overall_band: number | null
          pronunciation_band: number | null
          scorecard: Json
          session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          coaching?: Json
          created_at?: string
          fluency_band?: number | null
          grammar_band?: number | null
          id?: string
          lexical_band?: number | null
          overall_band?: number | null
          pronunciation_band?: number | null
          scorecard?: Json
          session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          coaching?: Json
          created_at?: string
          fluency_band?: number | null
          grammar_band?: number | null
          id?: string
          lexical_band?: number | null
          overall_band?: number | null
          pronunciation_band?: number | null
          scorecard?: Json
          session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "mock_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_s: number | null
          id: string
          kind: string
          metadata: Json
          started_at: string
          status: string
          tavus_conversation_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_s?: number | null
          id?: string
          kind?: string
          metadata?: Json
          started_at?: string
          status?: string
          tavus_conversation_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_s?: number | null
          id?: string
          kind?: string
          metadata?: Json
          started_at?: string
          status?: string
          tavus_conversation_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          exam_date: string | null
          target_band: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          exam_date?: string | null
          target_band?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          exam_date?: string | null
          target_band?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      progress_history: {
        Row: {
          created_at: string
          fluency_band: number | null
          grammar_band: number | null
          id: string
          lexical_band: number | null
          notes: string | null
          overall_band: number | null
          pronunciation_band: number | null
          recorded_at: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fluency_band?: number | null
          grammar_band?: number | null
          id?: string
          lexical_band?: number | null
          notes?: string | null
          overall_band?: number | null
          pronunciation_band?: number | null
          recorded_at?: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          fluency_band?: number | null
          grammar_band?: number | null
          id?: string
          lexical_band?: number | null
          notes?: string | null
          overall_band?: number | null
          pronunciation_band?: number | null
          recorded_at?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_history_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "mock_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      transcripts: {
        Row: {
          audio_url: string | null
          created_at: string
          ended_at_s: number | null
          id: string
          part: number
          prompt: string | null
          session_id: string
          speaker: string
          started_at_s: number | null
          text: string
          turn_idx: number
          user_id: string
          words: Json
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          ended_at_s?: number | null
          id?: string
          part: number
          prompt?: string | null
          session_id: string
          speaker: string
          started_at_s?: number | null
          text?: string
          turn_idx: number
          user_id: string
          words?: Json
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          ended_at_s?: number | null
          id?: string
          part?: number
          prompt?: string | null
          session_id?: string
          speaker?: string
          started_at_s?: number | null
          text?: string
          turn_idx?: number
          user_id?: string
          words?: Json
        }
        Relationships: [
          {
            foreignKeyName: "transcripts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "mock_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
