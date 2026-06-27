export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      assessment_results: {
        Row: {
          created_at: string;
          fluency_band: number | null;
          grammar_band: number | null;
          id: string;
          lexical_band: number | null;
          mock_session_id: string;
          notes: Json | null;
          overall_band: number;
          pronunciation_band: number | null;
          report: Json | null;
          scorecard: Json;
          transcript_chars: number | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          fluency_band?: number | null;
          grammar_band?: number | null;
          id?: string;
          lexical_band?: number | null;
          mock_session_id: string;
          notes?: Json | null;
          overall_band: number;
          pronunciation_band?: number | null;
          report?: Json | null;
          scorecard: Json;
          transcript_chars?: number | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          fluency_band?: number | null;
          grammar_band?: number | null;
          id?: string;
          lexical_band?: number | null;
          mock_session_id?: string;
          notes?: Json | null;
          overall_band?: number;
          pronunciation_band?: number | null;
          report?: Json | null;
          scorecard?: Json;
          transcript_chars?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_results_mock_session_id_fkey";
            columns: ["mock_session_id"];
            isOneToOne: true;
            referencedRelation: "mock_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      mock_sessions: {
        Row: {
          created_at: string;
          ended_at: string | null;
          id: string;
          parts: number[];
          scored_at: string | null;
          started_at: string;
          status: string;
          tavus_conversation_id: string;
          tavus_conversation_url: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          parts?: number[];
          scored_at?: string | null;
          started_at?: string;
          status?: string;
          tavus_conversation_id: string;
          tavus_conversation_url?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          ended_at?: string | null;
          id?: string;
          parts?: number[];
          scored_at?: string | null;
          started_at?: string;
          status?: string;
          tavus_conversation_id?: string;
          tavus_conversation_url?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          exam_date: string | null;
          target_band: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          exam_date?: string | null;
          target_band?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          exam_date?: string | null;
          target_band?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      progress_history: {
        Row: {
          assessment_result_id: string;
          fluency_band: number | null;
          grammar_band: number | null;
          id: string;
          lexical_band: number | null;
          mock_session_id: string;
          overall_band: number;
          pronunciation_band: number | null;
          recorded_at: string;
          user_id: string;
        };
        Insert: {
          assessment_result_id: string;
          fluency_band?: number | null;
          grammar_band?: number | null;
          id?: string;
          lexical_band?: number | null;
          mock_session_id: string;
          overall_band: number;
          pronunciation_band?: number | null;
          recorded_at?: string;
          user_id: string;
        };
        Update: {
          assessment_result_id?: string;
          fluency_band?: number | null;
          grammar_band?: number | null;
          id?: string;
          lexical_band?: number | null;
          mock_session_id?: string;
          overall_band?: number;
          pronunciation_band?: number | null;
          recorded_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "progress_history_assessment_result_id_fkey";
            columns: ["assessment_result_id"];
            isOneToOne: true;
            referencedRelation: "assessment_results";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "progress_history_mock_session_id_fkey";
            columns: ["mock_session_id"];
            isOneToOne: false;
            referencedRelation: "mock_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      transcripts: {
        Row: {
          candidate_text: string | null;
          captured_at: string;
          id: string;
          mock_session_id: string;
          raw_transcript: Json;
          source: string;
          tavus_conversation_id: string;
          user_id: string;
        };
        Insert: {
          candidate_text?: string | null;
          captured_at?: string;
          id?: string;
          mock_session_id: string;
          raw_transcript: Json;
          source?: string;
          tavus_conversation_id: string;
          user_id: string;
        };
        Update: {
          candidate_text?: string | null;
          captured_at?: string;
          id?: string;
          mock_session_id?: string;
          raw_transcript?: Json;
          source?: string;
          tavus_conversation_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transcripts_mock_session_id_fkey";
            columns: ["mock_session_id"];
            isOneToOne: true;
            referencedRelation: "mock_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
