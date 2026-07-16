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
      donation_history: {
        Row: {
          completed_at: string
          created_at: string
          donor_name: string
          hospital_name: string | null
          id: string
          match_id: string | null
          organ: Database["public"]["Enums"]["organ_type"]
          recipient_name: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          donor_name: string
          hospital_name?: string | null
          id?: string
          match_id?: string | null
          organ: Database["public"]["Enums"]["organ_type"]
          recipient_name: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          donor_name?: string
          hospital_name?: string | null
          id?: string
          match_id?: string | null
          organ?: Database["public"]["Enums"]["organ_type"]
          recipient_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "donation_history_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      donors: {
        Row: {
          age: number
          blood_type: Database["public"]["Enums"]["blood_type"]
          city: string
          created_at: string
          full_name: string
          hospital_name: string | null
          id: string
          medical_notes: string | null
          organ: Database["public"]["Enums"]["organ_type"]
          phone: string | null
          status: Database["public"]["Enums"]["donor_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          age: number
          blood_type: Database["public"]["Enums"]["blood_type"]
          city: string
          created_at?: string
          full_name: string
          hospital_name?: string | null
          id?: string
          medical_notes?: string | null
          organ: Database["public"]["Enums"]["organ_type"]
          phone?: string | null
          status?: Database["public"]["Enums"]["donor_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          age?: number
          blood_type?: Database["public"]["Enums"]["blood_type"]
          city?: string
          created_at?: string
          full_name?: string
          hospital_name?: string | null
          id?: string
          medical_notes?: string | null
          organ?: Database["public"]["Enums"]["organ_type"]
          phone?: string | null
          status?: Database["public"]["Enums"]["donor_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          created_at: string
          created_by: string | null
          donor_id: string
          id: string
          notes: string | null
          recipient_id: string
          status: Database["public"]["Enums"]["match_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          donor_id: string
          id?: string
          notes?: string | null
          recipient_id: string
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          donor_id?: string
          id?: string
          notes?: string | null
          recipient_id?: string
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "donors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          blood_type: Database["public"]["Enums"]["blood_type"] | null
          city: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          blood_type?: Database["public"]["Enums"]["blood_type"] | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          blood_type?: Database["public"]["Enums"]["blood_type"] | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recipients: {
        Row: {
          age: number
          blood_type: Database["public"]["Enums"]["blood_type"]
          city: string
          created_at: string
          full_name: string
          hospital_name: string | null
          id: string
          medical_notes: string | null
          organ_needed: Database["public"]["Enums"]["organ_type"]
          phone: string | null
          status: Database["public"]["Enums"]["recipient_status"]
          updated_at: string
          urgency: Database["public"]["Enums"]["urgency_level"]
          user_id: string
        }
        Insert: {
          age: number
          blood_type: Database["public"]["Enums"]["blood_type"]
          city: string
          created_at?: string
          full_name: string
          hospital_name?: string | null
          id?: string
          medical_notes?: string | null
          organ_needed: Database["public"]["Enums"]["organ_type"]
          phone?: string | null
          status?: Database["public"]["Enums"]["recipient_status"]
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
          user_id: string
        }
        Update: {
          age?: number
          blood_type?: Database["public"]["Enums"]["blood_type"]
          city?: string
          created_at?: string
          full_name?: string
          hospital_name?: string | null
          id?: string
          medical_notes?: string | null
          organ_needed?: Database["public"]["Enums"]["organ_type"]
          phone?: string | null
          status?: Database["public"]["Enums"]["recipient_status"]
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "hospital" | "donor" | "recipient" | "user"
      blood_type: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-"
      donor_status: "available" | "matched" | "donated" | "withdrawn"
      match_status: "proposed" | "accepted" | "rejected" | "completed"
      organ_type:
        | "kidney"
        | "liver"
        | "heart"
        | "lung"
        | "pancreas"
        | "cornea"
        | "bone_marrow"
        | "intestine"
      recipient_status: "waiting" | "matched" | "transplanted" | "cancelled"
      urgency_level: "routine" | "urgent" | "critical"
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
      app_role: ["admin", "hospital", "donor", "recipient", "user"],
      blood_type: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      donor_status: ["available", "matched", "donated", "withdrawn"],
      match_status: ["proposed", "accepted", "rejected", "completed"],
      organ_type: [
        "kidney",
        "liver",
        "heart",
        "lung",
        "pancreas",
        "cornea",
        "bone_marrow",
        "intestine",
      ],
      recipient_status: ["waiting", "matched", "transplanted", "cancelled"],
      urgency_level: ["routine", "urgent", "critical"],
    },
  },
} as const
