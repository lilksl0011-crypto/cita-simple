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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      blocked_times: {
        Row: {
          created_at: string
          during: unknown
          id: string
          reason: string | null
          workshop_id: string
        }
        Insert: {
          created_at?: string
          during: unknown
          id?: string
          reason?: string | null
          workshop_id: string
        }
        Update: {
          created_at?: string
          during?: unknown
          id?: string
          reason?: string | null
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_times_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_events: {
        Row: {
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          booking_id: string
          created_at: string
          event_type: Database["public"]["Enums"]["booking_event_type"]
          id: string
          metadata: Json
        }
        Insert: {
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          booking_id: string
          created_at?: string
          event_type: Database["public"]["Enums"]["booking_event_type"]
          id?: string
          metadata?: Json
        }
        Update: {
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          booking_id?: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["booking_event_type"]
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          buffer_snapshot_minutes: number
          created_at: string
          customer_email: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          duration_snapshot_minutes: number
          end_at: string
          id: string
          idempotency_key: string | null
          manage_token_expires_at: string | null
          manage_token_hash: string | null
          needs_attention: boolean
          notes: string | null
          occupied_until: string
          price_snapshot: number | null
          price_type_snapshot: Database["public"]["Enums"]["price_type"]
          proposed_start_at: string | null
          response_deadline_at: string | null
          service_id: string
          service_name_snapshot: string
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          vehicle_id: string | null
          workshop_id: string
        }
        Insert: {
          buffer_snapshot_minutes?: number
          created_at?: string
          customer_email: string
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          duration_snapshot_minutes: number
          end_at: string
          id?: string
          idempotency_key?: string | null
          manage_token_expires_at?: string | null
          manage_token_hash?: string | null
          needs_attention?: boolean
          notes?: string | null
          occupied_until: string
          price_snapshot?: number | null
          price_type_snapshot: Database["public"]["Enums"]["price_type"]
          proposed_start_at?: string | null
          response_deadline_at?: string | null
          service_id: string
          service_name_snapshot: string
          start_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          vehicle_id?: string | null
          workshop_id: string
        }
        Update: {
          buffer_snapshot_minutes?: number
          created_at?: string
          customer_email?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          duration_snapshot_minutes?: number
          end_at?: string
          id?: string
          idempotency_key?: string | null
          manage_token_expires_at?: string | null
          manage_token_hash?: string | null
          needs_attention?: boolean
          notes?: string | null
          occupied_until?: string
          price_snapshot?: number | null
          price_type_snapshot?: Database["public"]["Enums"]["price_type"]
          proposed_start_at?: string | null
          response_deadline_at?: string | null
          service_id?: string
          service_name_snapshot?: string
          start_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          vehicle_id?: string | null
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          attempts: number
          booking_id: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          error_message: string | null
          id: string
          provider: string | null
          provider_message_id: string | null
          recipient: string
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          template: string
        }
        Insert: {
          attempts?: number
          booking_id?: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          error_message?: string | null
          id?: string
          provider?: string | null
          provider_message_id?: string | null
          recipient: string
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template: string
        }
        Update: {
          attempts?: number
          booking_id?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          error_message?: string | null
          id?: string
          provider?: string | null
          provider_message_id?: string | null
          recipient?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          booking_mode: Database["public"]["Enums"]["booking_mode"]
          buffer_minutes: number
          category: string
          created_at: string
          deleted_at: string | null
          description: string | null
          duration_minutes: number
          id: string
          name: string
          price_from: number | null
          price_type: Database["public"]["Enums"]["price_type"]
          updated_at: string
          workshop_id: string
        }
        Insert: {
          active?: boolean
          booking_mode?: Database["public"]["Enums"]["booking_mode"]
          buffer_minutes?: number
          category: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          name: string
          price_from?: number | null
          price_type?: Database["public"]["Enums"]["price_type"]
          updated_at?: string
          workshop_id: string
        }
        Update: {
          active?: boolean
          booking_mode?: Database["public"]["Enums"]["booking_mode"]
          buffer_minutes?: number
          category?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          name?: string
          price_from?: number | null
          price_type?: Database["public"]["Enums"]["price_type"]
          updated_at?: string
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      system_errors: {
        Row: {
          code: string | null
          context: Json
          created_at: string
          id: string
          message: string
          source: string
        }
        Insert: {
          code?: string | null
          context?: Json
          created_at?: string
          id?: string
          message: string
          source: string
        }
        Update: {
          code?: string | null
          context?: Json
          created_at?: string
          id?: string
          message?: string
          source?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          make: string | null
          model: string | null
          plate: string | null
          year: number | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          make?: string | null
          model?: string | null
          plate?: string | null
          year?: number | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          make?: string | null
          model?: string | null
          plate?: string | null
          year?: number | null
        }
        Relationships: []
      }
      workshop_closures: {
        Row: {
          created_at: string
          date: string
          id: string
          reason: string | null
          workshop_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          reason?: string | null
          workshop_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          reason?: string | null
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_closures_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_hours: {
        Row: {
          closes: string
          id: string
          opens: string
          weekday: number
          workshop_id: string
        }
        Insert: {
          closes: string
          id?: string
          opens: string
          weekday: number
          workshop_id: string
        }
        Update: {
          closes?: string
          id?: string
          opens?: string
          weekday?: number
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_hours_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshops: {
        Row: {
          active: boolean
          address: string | null
          cancellation_window_minutes: number
          capacity_per_slot: number
          city: string | null
          country: string
          created_at: string
          description: string | null
          email: string | null
          id: string
          is_demo: boolean
          max_booking_horizon_days: number
          min_lead_time_minutes: number
          name: string
          onboarding_completed_at: string | null
          onboarding_step: number
          owner_id: string | null
          phone: string | null
          postal_code: string | null
          region: string | null
          request_sla_minutes: number
          slot_interval_minutes: number
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          cancellation_window_minutes?: number
          capacity_per_slot?: number
          city?: string | null
          country?: string
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          is_demo?: boolean
          max_booking_horizon_days?: number
          min_lead_time_minutes?: number
          name: string
          onboarding_completed_at?: string | null
          onboarding_step?: number
          owner_id?: string | null
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          request_sla_minutes?: number
          slot_interval_minutes?: number
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          cancellation_window_minutes?: number
          capacity_per_slot?: number
          city?: string | null
          country?: string
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          is_demo?: boolean
          max_booking_horizon_days?: number
          min_lead_time_minutes?: number
          name?: string
          onboarding_completed_at?: string | null
          onboarding_step?: number
          owner_id?: string | null
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          request_sla_minutes?: number
          slot_interval_minutes?: number
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshops_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_workshop_account: { Args: never; Returns: string }
      can_manage_workshop: { Args: { _workshop_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      owns_workshop: { Args: { _workshop_id: string }; Returns: boolean }
      save_my_hours: { Args: { _intervals: Json }; Returns: undefined }
      slugify: { Args: { _txt: string }; Returns: string }
      workshop_ready: { Args: { _wid: string }; Returns: boolean }
    }
    Enums: {
      actor_type: "customer" | "workshop" | "admin" | "system"
      app_role: "admin" | "workshop" | "customer"
      booking_event_type:
        | "created"
        | "confirmed"
        | "declined"
        | "expired"
        | "cancelled_by_customer"
        | "cancelled_by_workshop"
        | "completed"
        | "no_show"
        | "rescheduled"
        | "availability_conflict"
        | "proposal_created"
        | "proposal_accepted"
        | "proposal_rejected"
      booking_mode: "instant" | "request"
      booking_status:
        | "pending"
        | "confirmed"
        | "declined"
        | "expired"
        | "cancelled"
        | "completed"
        | "no_show"
      notification_channel: "email" | "whatsapp" | "sms"
      notification_status: "queued" | "sent" | "failed" | "cancelled"
      price_type: "fixed" | "from" | "quote"
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
      actor_type: ["customer", "workshop", "admin", "system"],
      app_role: ["admin", "workshop", "customer"],
      booking_event_type: [
        "created",
        "confirmed",
        "declined",
        "expired",
        "cancelled_by_customer",
        "cancelled_by_workshop",
        "completed",
        "no_show",
        "rescheduled",
        "availability_conflict",
        "proposal_created",
        "proposal_accepted",
        "proposal_rejected",
      ],
      booking_mode: ["instant", "request"],
      booking_status: [
        "pending",
        "confirmed",
        "declined",
        "expired",
        "cancelled",
        "completed",
        "no_show",
      ],
      notification_channel: ["email", "whatsapp", "sms"],
      notification_status: ["queued", "sent", "failed", "cancelled"],
      price_type: ["fixed", "from", "quote"],
    },
  },
} as const
