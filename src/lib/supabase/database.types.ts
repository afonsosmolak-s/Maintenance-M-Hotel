// Gerado a partir do banco (Supabase generate_typescript_types). Não editar à mão.
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
      assets: {
        Row: {
          category_id: string | null
          created_at: string
          establishment_id: string
          id: string
          installed_on: string | null
          internal_code: string | null
          location_id: string
          manufacturer: string | null
          model: string | null
          name: string
          notes: string | null
          operational_status: string
          updated_at: string
          warranty_until: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          establishment_id: string
          id?: string
          installed_on?: string | null
          internal_code?: string | null
          location_id: string
          manufacturer?: string | null
          model?: string | null
          name: string
          notes?: string | null
          operational_status?: string
          updated_at?: string
          warranty_until?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          establishment_id?: string
          id?: string
          installed_on?: string | null
          internal_code?: string | null
          location_id?: string
          manufacturer?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          operational_status?: string
          updated_at?: string
          warranty_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_establishment_id_category_id_fkey"
            columns: ["establishment_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["establishment_id", "id"]
          },
          {
            foreignKeyName: "assets_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_establishment_id_location_id_fkey"
            columns: ["establishment_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["establishment_id", "id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          establishment_id: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          establishment_id: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          establishment_id?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      location_types: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_types_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          establishment_id: string
          id: string
          location_type_id: string | null
          name: string
          parent_id: string | null
          sector_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          establishment_id: string
          id?: string
          location_type_id?: string | null
          name: string
          parent_id?: string | null
          sector_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          establishment_id?: string
          id?: string
          location_type_id?: string | null
          name?: string
          parent_id?: string | null
          sector_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_establishment_id_location_type_id_fkey"
            columns: ["establishment_id", "location_type_id"]
            isOneToOne: false
            referencedRelation: "location_types"
            referencedColumns: ["establishment_id", "id"]
          },
          {
            foreignKeyName: "locations_establishment_id_parent_id_fkey"
            columns: ["establishment_id", "parent_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["establishment_id", "id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          after: Json | null
          before: Json | null
          changed_fields: string[] | null
          created_at: string
          entity_id: string | null
          entity_type: string
          establishment_id: string | null
          id: number
          origin: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          after?: Json | null
          before?: Json | null
          changed_fields?: string[] | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          establishment_id?: string | null
          id?: never
          origin?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          after?: Json | null
          before?: Json | null
          changed_fields?: string[] | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          establishment_id?: string | null
          id?: never
          origin?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      establishments: {
        Row: {
          accent_color: string | null
          cnpj: string
          created_at: string
          id: string
          kind: string
          legal_name: string
          logo_path: string | null
          name: string
          sla_hours: Json
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          cnpj: string
          created_at?: string
          id?: string
          kind: string
          legal_name: string
          logo_path?: string | null
          name: string
          sla_hours?: Json
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          cnpj?: string
          created_at?: string
          id?: string
          kind?: string
          legal_name?: string
          logo_path?: string | null
          name?: string
          sla_hours?: Json
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          role_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          role_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          role_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_establishment_id_role_id_fkey"
            columns: ["establishment_id", "role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["establishment_id", "id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          anonymized_at: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          anonymized_at?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          anonymized_at?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          name: string
          permissions: string[]
          system_key: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          name: string
          permissions?: string[]
          system_key?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          name?: string
          permissions?: string[]
          system_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_member: {
        Args: {
          p_establishment_id: string
          p_role_id: string
          p_user_id: string
        }
        Returns: string
      }
      apply_establishment_template: {
        Args: { p_establishment_id: string; p_template: string }
        Returns: undefined
      }
      create_establishment: {
        Args: {
          p_cnpj: string
          p_kind: string
          p_legal_name: string
          p_name: string
          p_owner_user_id: string
        }
        Returns: string
      }
      find_user_id_by_email: { Args: { p_email: string }; Returns: string }
      my_establishments: {
        Args: never
        Returns: {
          establishment_id: string
          establishment_status: string
          is_owner: boolean
          kind: string
          membership_status: string
          name: string
          permissions: string[]
          role_name: string
        }[]
      }
      my_platform_access: { Args: never; Returns: string }
      platform_establishments: {
        Args: never
        Returns: {
          cnpj: string
          created_at: string
          id: string
          kind: string
          last_sign_in_at: string
          legal_name: string
          member_count: number
          name: string
          owner_email: string
          owner_name: string
          status: string
        }[]
      }
      set_establishment_status: {
        Args: { p_establishment_id: string; p_status: string }
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
