// Generated from Supabase after the 2026-09-30 reliability migration.
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
      account_requests: {
        Row: {
          company_name: string
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string
          reviewed_at: string | null
          status: string
        }
        Insert: {
          company_name: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone?: string
          reviewed_at?: string | null
          status?: string
        }
        Update: {
          company_name?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string
          reviewed_at?: string | null
          status?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          after_hours_multiplier: number
          bases: Json
          client_portal: Json
          company_id: string
          config: Json
          created_at: string
          drive_time_buffer: number
          extra_stop_mins: number
          geofences: Json
          hazard_multiplier: number
          hourly_max: number
          hourly_min: number
          hourly_rate: number
          load_unload_base_mins: number
          metro_multiplier: number
          mileage_rate: number
          pricing: Json
          pricing_mode: string
          road_club_multiplier: number
          rounding_interval: number
          surcharges: Json
          updated_at: string
          users: Json
        }
        Insert: {
          after_hours_multiplier?: number
          bases?: Json
          client_portal?: Json
          company_id: string
          config?: Json
          created_at?: string
          drive_time_buffer?: number
          extra_stop_mins?: number
          geofences?: Json
          hazard_multiplier?: number
          hourly_max?: number
          hourly_min?: number
          hourly_rate?: number
          load_unload_base_mins?: number
          metro_multiplier?: number
          mileage_rate?: number
          pricing?: Json
          pricing_mode?: string
          road_club_multiplier?: number
          rounding_interval?: number
          surcharges?: Json
          updated_at?: string
          users?: Json
        }
        Update: {
          after_hours_multiplier?: number
          bases?: Json
          client_portal?: Json
          company_id?: string
          config?: Json
          created_at?: string
          drive_time_buffer?: number
          extra_stop_mins?: number
          geofences?: Json
          hazard_multiplier?: number
          hourly_max?: number
          hourly_min?: number
          hourly_rate?: number
          load_unload_base_mins?: number
          metro_multiplier?: number
          mileage_rate?: number
          pricing?: Json
          pricing_mode?: string
          road_club_multiplier?: number
          rounding_interval?: number
          surcharges?: Json
          updated_at?: string
          users?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_config_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          approval_threshold: number | null
          client_name: string
          company_id: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          logo_path: string | null
          pricing: Json
          updated_at: string
        }
        Insert: {
          approval_threshold?: number | null
          client_name: string
          company_id: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          logo_path?: string | null
          pricing?: Json
          updated_at?: string
        }
        Update: {
          approval_threshold?: number | null
          client_name?: string
          company_id?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          logo_path?: string | null
          pricing?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      company_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          client_id: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          full_name: string | null
          id: string
          invited_by: string | null
          role: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          role: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_invites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
            foreignKeyName: "company_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_subscriptions: {
        Row: {
          billing_interval: string | null
          cancel_at_period_end: boolean
          company_id: string
          created_at: string
          current_period_ends_at: string | null
          metadata: Json
          plan_code: string
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          billing_interval?: string | null
          cancel_at_period_end?: boolean
          company_id: string
          created_at?: string
          current_period_ends_at?: string | null
          metadata?: Json
          plan_code?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          billing_interval?: string | null
          cancel_at_period_end?: boolean
          company_id?: string
          created_at?: string
          current_period_ends_at?: string | null
          metadata?: Json
          plan_code?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_deliveries: {
        Row: {
          actor_id: string
          company_id: string
          created_at: string
          event_type: string
          id: string
          payload: Json
          provider_message_id: string | null
          quote_id: string
          request_hash: string
          request_id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          actor_id: string
          company_id: string
          created_at?: string
          event_type: string
          id?: string
          payload: Json
          provider_message_id?: string | null
          quote_id: string
          request_hash: string
          request_id: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          actor_id?: string
          company_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          provider_message_id?: string | null
          quote_id?: string
          request_hash?: string
          request_id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_deliveries_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_specs: {
        Row: {
          company_id: string | null
          configuration: string | null
          created_at: string
          height_ft: number | null
          height_in: number | null
          id: string
          is_heavy: boolean
          length_ft: number | null
          length_in: number | null
          make: string
          model: string
          operating_weight_lbs: number | null
          retrieved_at: string | null
          serial_number: string | null
          source: string | null
          sources: Json
          updated_at: string
          verification_status: string
          weight_type: string
          width_ft: number | null
          width_in: number | null
        }
        Insert: {
          company_id?: string | null
          configuration?: string | null
          created_at?: string
          height_ft?: number | null
          height_in?: number | null
          id?: string
          is_heavy?: boolean
          length_ft?: number | null
          length_in?: number | null
          make: string
          model: string
          operating_weight_lbs?: number | null
          retrieved_at?: string | null
          serial_number?: string | null
          source?: string | null
          sources?: Json
          updated_at?: string
          verification_status?: string
          weight_type?: string
          width_ft?: number | null
          width_in?: number | null
        }
        Update: {
          company_id?: string | null
          configuration?: string | null
          created_at?: string
          height_ft?: number | null
          height_in?: number | null
          id?: string
          is_heavy?: boolean
          length_ft?: number | null
          length_in?: number | null
          make?: string
          model?: string
          operating_weight_lbs?: number | null
          retrieved_at?: string | null
          serial_number?: string | null
          source?: string | null
          sources?: Json
          updated_at?: string
          verification_status?: string
          weight_type?: string
          width_ft?: number | null
          width_in?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_specs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_acceptances: {
        Row: {
          accepted_at: string
          id: number
          privacy_version: string
          terms_version: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          id?: never
          privacy_version: string
          terms_version: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          id?: never
          privacy_version?: string
          terms_version?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          client_id: string | null
          company_id: string
          created_at: string
          default_base_id: string | null
          email: string
          full_name: string
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          company_id: string
          created_at?: string
          default_base_id?: string | null
          email: string
          full_name?: string
          id: string
          role: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          company_id?: string
          created_at?: string
          default_base_id?: string | null
          email?: string
          full_name?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_events: {
        Row: {
          actor_id: string | null
          company_id: string
          created_at: string
          event_type: string
          from_status: string | null
          id: number
          metadata: Json
          quote_id: string
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          company_id: string
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: never
          metadata?: Json
          quote_id: string
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          company_id?: string
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: never
          metadata?: Json
          quote_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_events_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_logs: {
        Row: {
          all_waypoints: Json
          applied_surcharges: Json
          base_yard_id: string | null
          bol_name: string | null
          bol_path: string | null
          bol_type: string | null
          client_id: string | null
          company_id: string
          created_at: string
          custom_quote: number | null
          customer_name: string | null
          customer_phone: string | null
          dropoff_address: string
          id: string
          max_quote: number | null
          min_quote: number | null
          notes: string | null
          pickup_address: string
          quote_details: Json
          quote_reference: string
          quote_source: string
          request_hash: string | null
          request_id: string | null
          status: string
          total_hours: number | null
          total_miles: number | null
          truck_class: string | null
          user_id: string
        }
        Insert: {
          all_waypoints?: Json
          applied_surcharges?: Json
          base_yard_id?: string | null
          bol_name?: string | null
          bol_path?: string | null
          bol_type?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          custom_quote?: number | null
          customer_name?: string | null
          customer_phone?: string | null
          dropoff_address: string
          id?: string
          max_quote?: number | null
          min_quote?: number | null
          notes?: string | null
          pickup_address: string
          quote_details?: Json
          quote_reference?: string
          quote_source?: string
          request_hash?: string | null
          request_id?: string | null
          status?: string
          total_hours?: number | null
          total_miles?: number | null
          truck_class?: string | null
          user_id: string
        }
        Update: {
          all_waypoints?: Json
          applied_surcharges?: Json
          base_yard_id?: string | null
          bol_name?: string | null
          bol_path?: string | null
          bol_type?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          custom_quote?: number | null
          customer_name?: string | null
          customer_phone?: string | null
          dropoff_address?: string
          id?: string
          max_quote?: number | null
          min_quote?: number | null
          notes?: string | null
          pickup_address?: string
          quote_details?: Json
          quote_reference?: string
          quote_source?: string
          request_hash?: string | null
          request_id?: string | null
          status?: string
          total_hours?: number | null
          total_miles?: number | null
          truck_class?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      state_transport_limits: {
        Row: {
          legal_height_in: number
          legal_weight_lbs: number
          legal_width_in: number
          notes: string | null
          one_escort_height_in: number | null
          one_escort_width_in: number | null
          retrieved_at: string | null
          source_url: string | null
          state_code: string
          state_name: string
          two_escort_height_in: number | null
          two_escort_width_in: number | null
          updated_at: string
        }
        Insert: {
          legal_height_in: number
          legal_weight_lbs: number
          legal_width_in: number
          notes?: string | null
          one_escort_height_in?: number | null
          one_escort_width_in?: number | null
          retrieved_at?: string | null
          source_url?: string | null
          state_code: string
          state_name: string
          two_escort_height_in?: number | null
          two_escort_width_in?: number | null
          updated_at?: string
        }
        Update: {
          legal_height_in?: number
          legal_weight_lbs?: number
          legal_width_in?: number
          notes?: string | null
          one_escort_height_in?: number | null
          one_escort_width_in?: number | null
          retrieved_at?: string | null
          source_url?: string | null
          state_code?: string
          state_name?: string
          two_escort_height_in?: number | null
          two_escort_width_in?: number | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_company_invite: {
        Args: {
          p_full_name: string
          p_privacy_version: string
          p_terms_version: string
          p_token: string
          p_user_id: string
        }
        Returns: {
          company_id: string
          email: string
          role: string
        }[]
      }
      complete_email_delivery: {
        Args: { p_id: string; p_provider_message_id: string }
        Returns: undefined
      }
      consume_api_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: {
          allowed: boolean
          retry_after: number
        }[]
      }
      is_manager: { Args: never; Returns: boolean }
      my_company_id: { Args: never; Returns: string }
      my_role: { Args: never; Returns: string }
      search_quotes: {
        Args: { p_page?: number; p_query: string }
        Returns: {
          all_waypoints: Json
          applied_surcharges: Json
          base_yard_id: string | null
          bol_name: string | null
          bol_path: string | null
          bol_type: string | null
          client_id: string | null
          company_id: string
          created_at: string
          custom_quote: number | null
          customer_name: string | null
          customer_phone: string | null
          dropoff_address: string
          id: string
          max_quote: number | null
          min_quote: number | null
          notes: string | null
          pickup_address: string
          quote_details: Json
          quote_reference: string
          quote_source: string
          request_hash: string | null
          request_id: string | null
          status: string
          total_hours: number | null
          total_miles: number | null
          truck_class: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "quote_logs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      update_my_default_base: {
        Args: { new_default_base_id: string }
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

