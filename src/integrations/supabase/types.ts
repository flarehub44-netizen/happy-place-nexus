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
      ad_signal_history: {
        Row: {
          ad_id: string
          id: string
          recorded_at: string
          signal_score: number
        }
        Insert: {
          ad_id: string
          id?: string
          recorded_at?: string
          signal_score: number
        }
        Update: {
          ad_id?: string
          id?: string
          recorded_at?: string
          signal_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "ad_signal_history_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_variations: {
        Row: {
          ad_id: string
          created_at: string
          generated_by: string
          id: string
          variation_text: string
          variation_type: string
        }
        Insert: {
          ad_id: string
          created_at?: string
          generated_by?: string
          id?: string
          variation_text: string
          variation_type?: string
        }
        Update: {
          ad_id?: string
          created_at?: string
          generated_by?: string
          id?: string
          variation_text?: string
          variation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_variations_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      ads: {
        Row: {
          ad_library_url: string | null
          advertiser_id: string | null
          ai_analyzed_at: string | null
          ai_summary: string | null
          ai_tags: string[] | null
          created_at: string
          cta: string | null
          days_running: number
          detected_angle: string | null
          first_seen_at: string
          format: Database["public"]["Enums"]["ad_format"]
          headline: string | null
          id: string
          landing_url: string | null
          last_seen_at: string
          market_pattern: string | null
          media_url: string | null
          niche: Database["public"]["Enums"]["niche"]
          platform: Database["public"]["Enums"]["ad_platform"]
          policy_risk_level: string | null
          policy_risk_notes: string | null
          potential_label: string | null
          price_brl: number | null
          primary_text: string | null
          raw_import_id: string | null
          signal_score: number | null
          status: Database["public"]["Enums"]["ad_status"]
          thumbnail_url: string | null
          updated_at: string
          variations_count: number
        }
        Insert: {
          ad_library_url?: string | null
          advertiser_id?: string | null
          ai_analyzed_at?: string | null
          ai_summary?: string | null
          ai_tags?: string[] | null
          created_at?: string
          cta?: string | null
          days_running?: number
          detected_angle?: string | null
          first_seen_at?: string
          format?: Database["public"]["Enums"]["ad_format"]
          headline?: string | null
          id?: string
          landing_url?: string | null
          last_seen_at?: string
          market_pattern?: string | null
          media_url?: string | null
          niche?: Database["public"]["Enums"]["niche"]
          platform?: Database["public"]["Enums"]["ad_platform"]
          policy_risk_level?: string | null
          policy_risk_notes?: string | null
          potential_label?: string | null
          price_brl?: number | null
          primary_text?: string | null
          raw_import_id?: string | null
          signal_score?: number | null
          status?: Database["public"]["Enums"]["ad_status"]
          thumbnail_url?: string | null
          updated_at?: string
          variations_count?: number
        }
        Update: {
          ad_library_url?: string | null
          advertiser_id?: string | null
          ai_analyzed_at?: string | null
          ai_summary?: string | null
          ai_tags?: string[] | null
          created_at?: string
          cta?: string | null
          days_running?: number
          detected_angle?: string | null
          first_seen_at?: string
          format?: Database["public"]["Enums"]["ad_format"]
          headline?: string | null
          id?: string
          landing_url?: string | null
          last_seen_at?: string
          market_pattern?: string | null
          media_url?: string | null
          niche?: Database["public"]["Enums"]["niche"]
          platform?: Database["public"]["Enums"]["ad_platform"]
          policy_risk_level?: string | null
          policy_risk_notes?: string | null
          potential_label?: string | null
          price_brl?: number | null
          primary_text?: string | null
          raw_import_id?: string | null
          signal_score?: number | null
          status?: Database["public"]["Enums"]["ad_status"]
          thumbnail_url?: string | null
          updated_at?: string
          variations_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ads_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_raw_import_id_fkey"
            columns: ["raw_import_id"]
            isOneToOne: false
            referencedRelation: "raw_ad_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      advertisers: {
        Row: {
          avatar_url: string | null
          created_at: string
          handle: string | null
          id: string
          name: string
          niche: Database["public"]["Enums"]["niche"]
          page_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          handle?: string | null
          id?: string
          name: string
          niche?: Database["public"]["Enums"]["niche"]
          page_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          handle?: string | null
          id?: string
          name?: string
          niche?: Database["public"]["Enums"]["niche"]
          page_url?: string | null
        }
        Relationships: []
      }
      raw_ad_imports: {
        Row: {
          created_at: string
          external_id: string | null
          id: string
          payload: Json
          platform: Database["public"]["Enums"]["ad_platform"]
          processed: boolean
          source: string
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          id?: string
          payload: Json
          platform?: Database["public"]["Enums"]["ad_platform"]
          processed?: boolean
          source?: string
        }
        Update: {
          created_at?: string
          external_id?: string | null
          id?: string
          payload?: Json
          platform?: Database["public"]["Enums"]["ad_platform"]
          processed?: boolean
          source?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      ad_format: "image" | "video" | "carousel" | "text"
      ad_platform: "meta" | "tiktok" | "youtube" | "kwai" | "other"
      ad_status:
        | "detected"
        | "analyzing"
        | "validated"
        | "attention"
        | "risk"
        | "archived"
      niche:
        | "emagrecimento"
        | "financas"
        | "relacionamento"
        | "espiritualidade"
        | "saude"
        | "beleza"
        | "culinaria"
        | "pets"
        | "educacao"
        | "marketing"
        | "desenvolvimento_pessoal"
        | "outros"
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
    Enums: {
      ad_format: ["image", "video", "carousel", "text"],
      ad_platform: ["meta", "tiktok", "youtube", "kwai", "other"],
      ad_status: [
        "detected",
        "analyzing",
        "validated",
        "attention",
        "risk",
        "archived",
      ],
      niche: [
        "emagrecimento",
        "financas",
        "relacionamento",
        "espiritualidade",
        "saude",
        "beleza",
        "culinaria",
        "pets",
        "educacao",
        "marketing",
        "desenvolvimento_pessoal",
        "outros",
      ],
    },
  },
} as const
