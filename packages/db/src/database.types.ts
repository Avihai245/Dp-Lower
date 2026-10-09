
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activity_log": {
                  Row: {
                    "actor_id": string | null,"actor_name": string | null,"code": string | null,"created_at": string,"id": string,"kind": string,"lead_id": string,"meta": NonNullable<Json>,"text": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"actor_name"?: string | null,"code"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"lead_id": string,"meta"?: NonNullable<Json>,"text": string
                  }
                  Update: {
                    "actor_id"?: string | null,"actor_name"?: string | null,"code"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"lead_id"?: string,"meta"?: NonNullable<Json>,"text"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "activity_log_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "admin_lead_rows"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_log_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    }
                  ]
                },"app_settings": {
                  Row: {
                    "key": string,"updated_at": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"applications": {
                  Row: {
                    "completed_at": string | null,"current_section": number,"data": NonNullable<Json>,"lead_id": string,"started_at": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"current_section"?: number,"data"?: NonNullable<Json>,"lead_id": string,"started_at"?: string,"updated_at"?: string
                  }
                  Update: {
                    "completed_at"?: string | null,"current_section"?: number,"data"?: NonNullable<Json>,"lead_id"?: string,"started_at"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "applications_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: true
      referencedRelation: "admin_lead_rows"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "applications_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: true
      referencedRelation: "leads"
      referencedColumns: ["id"]
    }
                  ]
                },"availability_exceptions": {
                  Row: {
                    "created_at": string,"id": string,"on_date": string,"reason": string | null,"start_time": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"on_date": string,"reason"?: string | null,"start_time"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"on_date"?: string,"reason"?: string | null,"start_time"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"availability_rules": {
                  Row: {
                    "active": boolean,"capacity": number,"id": string,"start_time": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"capacity"?: number,"id"?: string,"start_time": string,"weekday": number
                  }
                  Update: {
                    "active"?: boolean,"capacity"?: number,"id"?: string,"start_time"?: string,"weekday"?: number
                  }
                  Relationships: [
                    
                  ]
                },"bookings": {
                  Row: {
                    "assigned_to": string | null,"cancelled_at": string | null,"created_at": string,"ends_at": string,"id": string,"lead_id": string,"starts_at": string,"status": Database["public"]['Enums']["booking_status"],"timezone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_to"?: string | null,"cancelled_at"?: string | null,"created_at"?: string,"ends_at": string,"id"?: string,"lead_id": string,"starts_at": string,"status"?: Database["public"]['Enums']["booking_status"],"timezone"?: string | null
                  }
                  Update: {
                    "assigned_to"?: string | null,"cancelled_at"?: string | null,"created_at"?: string,"ends_at"?: string,"id"?: string,"lead_id"?: string,"starts_at"?: string,"status"?: Database["public"]['Enums']["booking_status"],"timezone"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "bookings_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "admin_lead_rows"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    }
                  ]
                },"callback_requests": {
                  Row: {
                    "created_at": string,"handled_by": string | null,"id": string,"lead_id": string | null,"locale": Database["public"]['Enums']["locale_code"],"name": string | null,"note": string | null,"phone": string,"source": string | null,"status": Database["public"]['Enums']["inbox_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"handled_by"?: string | null,"id"?: string,"lead_id"?: string | null,"locale"?: Database["public"]['Enums']["locale_code"],"name"?: string | null,"note"?: string | null,"phone": string,"source"?: string | null,"status"?: Database["public"]['Enums']["inbox_status"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"handled_by"?: string | null,"id"?: string,"lead_id"?: string | null,"locale"?: Database["public"]['Enums']["locale_code"],"name"?: string | null,"note"?: string | null,"phone"?: string,"source"?: string | null,"status"?: Database["public"]['Enums']["inbox_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "callback_requests_handled_by_fkey"
      columns: ["handled_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "callback_requests_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "admin_lead_rows"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "callback_requests_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    }
                  ]
                },"contact_submissions": {
                  Row: {
                    "consented_at": string | null,"created_at": string,"email": string | null,"handled_by": string | null,"id": string,"kind": string,"locale": Database["public"]['Enums']["locale_code"],"matter": string | null,"name": string,"note": string | null,"page": string | null,"phone": string | null,"source": string | null,"status": Database["public"]['Enums']["inbox_status"],"updated_at": string,"utm": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "consented_at"?: string | null,"created_at"?: string,"email"?: string | null,"handled_by"?: string | null,"id"?: string,"kind"?: string,"locale"?: Database["public"]['Enums']["locale_code"],"matter"?: string | null,"name": string,"note"?: string | null,"page"?: string | null,"phone"?: string | null,"source"?: string | null,"status"?: Database["public"]['Enums']["inbox_status"],"updated_at"?: string,"utm"?: NonNullable<Json>
                  }
                  Update: {
                    "consented_at"?: string | null,"created_at"?: string,"email"?: string | null,"handled_by"?: string | null,"id"?: string,"kind"?: string,"locale"?: Database["public"]['Enums']["locale_code"],"matter"?: string | null,"name"?: string,"note"?: string | null,"page"?: string | null,"phone"?: string | null,"source"?: string | null,"status"?: Database["public"]['Enums']["inbox_status"],"updated_at"?: string,"utm"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "contact_submissions_handled_by_fkey"
      columns: ["handled_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["user_id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "created_at": string,"doc_type": string,"file_name": string | null,"file_path": string | null,"file_size": number | null,"id": string,"lead_id": string,"mime_type": string | null,"requested_at": string | null,"review_note": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["doc_status"],"updated_at": string,"uploaded_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"doc_type": string,"file_name"?: string | null,"file_path"?: string | null,"file_size"?: number | null,"id"?: string,"lead_id": string,"mime_type"?: string | null,"requested_at"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["doc_status"],"updated_at"?: string,"uploaded_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"doc_type"?: string,"file_name"?: string | null,"file_path"?: string | null,"file_size"?: number | null,"id"?: string,"lead_id"?: string,"mime_type"?: string | null,"requested_at"?: string | null,"review_note"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["doc_status"],"updated_at"?: string,"uploaded_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "admin_lead_rows"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["user_id"]
    }
                  ]
                },"email_sequence_state": {
                  Row: {
                    "created_at": string,"event_id": string | null,"lead_id": string,"number": number,"reason": string | null,"scheduled_for": string,"status": Database["public"]['Enums']["sequence_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id"?: string | null,"lead_id": string,"number": number,"reason"?: string | null,"scheduled_for": string,"status": Database["public"]['Enums']["sequence_status"]
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string | null,"lead_id"?: string,"number"?: number,"reason"?: string | null,"scheduled_for"?: string,"status"?: Database["public"]['Enums']["sequence_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "email_sequence_state_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "email_sequence_state_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "admin_lead_rows"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "email_sequence_state_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "attempts": number,"channel": Database["public"]['Enums']["event_channel"],"created_at": string,"dedupe_key": string | null,"delivered_at": string | null,"id": string,"last_error": string | null,"lead_id": string | null,"locked_at": string | null,"next_attempt_at": string,"payload": NonNullable<Json>,"status": Database["public"]['Enums']["event_status"],"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"channel"?: Database["public"]['Enums']["event_channel"],"created_at"?: string,"dedupe_key"?: string | null,"delivered_at"?: string | null,"id"?: string,"last_error"?: string | null,"lead_id"?: string | null,"locked_at"?: string | null,"next_attempt_at"?: string,"payload"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["event_status"],"type": string
                  }
                  Update: {
                    "attempts"?: number,"channel"?: Database["public"]['Enums']["event_channel"],"created_at"?: string,"dedupe_key"?: string | null,"delivered_at"?: string | null,"id"?: string,"last_error"?: string | null,"lead_id"?: string | null,"locked_at"?: string | null,"next_attempt_at"?: string,"payload"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["event_status"],"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "admin_lead_rows"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    }
                  ]
                },"lead_notes": {
                  Row: {
                    "author_id": string | null,"author_name": string | null,"body": string,"created_at": string,"id": string,"lead_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"author_name"?: string | null,"body": string,"created_at"?: string,"id"?: string,"lead_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"author_name"?: string | null,"body"?: string,"created_at"?: string,"id"?: string,"lead_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lead_notes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["user_id"]
    },{
      foreignKeyName: "lead_notes_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "admin_lead_rows"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lead_notes_lead_id_fkey"
      columns: ["lead_id"]
isOneToOne: false
      referencedRelation: "leads"
      referencedColumns: ["id"]
    }
                  ]
                },"leads": {
                  Row: {
                    "account_created_at": string | null,"answers": NonNullable<Json>,"application_started_at": string | null,"case_ref": string,"consented_at": string | null,"created_at": string,"email": string,"email_verified_at": string | null,"full_name": string,"id": string,"locale": Database["public"]['Enums']["locale_code"],"next_action_done_at": string | null,"owner_id": string | null,"password_set_at": string | null,"phone": string | null,"result_emailed_at": string | null,"route": Database["public"]['Enums']["lead_route"] | null,"session_epoch": number,"source": string,"stage": Database["public"]['Enums']["lead_stage"],"stage_since": string,"status": Database["public"]['Enums']["lead_status"],"submitted_at": string | null,"tour_done": boolean,"unsubscribed_at": string | null,"updated_at": string,"user_id": string | null,"utm": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "account_created_at"?: string | null,"answers"?: NonNullable<Json>,"application_started_at"?: string | null,"case_ref"?: string,"consented_at"?: string | null,"created_at"?: string,"email": string,"email_verified_at"?: string | null,"full_name": string,"id"?: string,"locale"?: Database["public"]['Enums']["locale_code"],"next_action_done_at"?: string | null,"owner_id"?: string | null,"password_set_at"?: string | null,"phone"?: string | null,"result_emailed_at"?: string | null,"route"?: Database["public"]['Enums']["lead_route"] | null,"session_epoch"?: number,"source"?: string,"stage"?: Database["public"]['Enums']["lead_stage"],"stage_since"?: string,"status"?: Database["public"]['Enums']["lead_status"],"submitted_at"?: string | null,"tour_done"?: boolean,"unsubscribed_at"?: string | null,"updated_at"?: string,"user_id"?: string | null,"utm"?: NonNullable<Json>
                  }
                  Update: {
                    "account_created_at"?: string | null,"answers"?: NonNullable<Json>,"application_started_at"?: string | null,"case_ref"?: string,"consented_at"?: string | null,"created_at"?: string,"email"?: string,"email_verified_at"?: string | null,"full_name"?: string,"id"?: string,"locale"?: Database["public"]['Enums']["locale_code"],"next_action_done_at"?: string | null,"owner_id"?: string | null,"password_set_at"?: string | null,"phone"?: string | null,"result_emailed_at"?: string | null,"route"?: Database["public"]['Enums']["lead_route"] | null,"session_epoch"?: number,"source"?: string,"stage"?: Database["public"]['Enums']["lead_stage"],"stage_since"?: string,"status"?: Database["public"]['Enums']["lead_status"],"submitted_at"?: string | null,"tour_done"?: boolean,"unsubscribed_at"?: string | null,"updated_at"?: string,"user_id"?: string | null,"utm"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "leads_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["user_id"]
    }
                  ]
                },"rate_limits": {
                  Row: {
                    "hits": number,"key": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "hits"?: number,"key": string,"window_start": string
                  }
                  Update: {
                    "hits"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"staff": {
                  Row: {
                    "active": boolean,"created_at": string,"email": string,"full_name": string,"role": Database["public"]['Enums']["staff_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"email": string,"full_name": string,"role"?: Database["public"]['Enums']["staff_role"],"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"email"?: string,"full_name"?: string,"role"?: Database["public"]['Enums']["staff_role"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "admin_lead_rows": {
                  Row: {
                    "account_created_at": string | null,"answers": Json | null,"application_completed_at": string | null,"application_data": Json | null,"application_section": number | null,"application_started_at": string | null,"case_ref": string | null,"consented_at": string | null,"created_at": string | null,"docs_received": number | null,"email": string | null,"email_verified_at": string | null,"full_name": string | null,"id": string | null,"locale": Database["public"]['Enums']["locale_code"] | null,"next_action_done_at": string | null,"next_call_at": string | null,"notes_count": number | null,"owner_id": string | null,"password_set_at": string | null,"phone": string | null,"result_emailed_at": string | null,"route": Database["public"]['Enums']["lead_route"] | null,"source": string | null,"stage": Database["public"]['Enums']["lead_stage"] | null,"stage_since": string | null,"status": Database["public"]['Enums']["lead_status"] | null,"submitted_at": string | null,"tour_done": boolean | null,"unsubscribed_at": string | null,"updated_at": string | null,"user_id": string | null,"utm": Json | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "leads_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["user_id"]
    }
                  ]
                }
          }
          Functions: {
            "auth_user_id_by_email":
{ Args: { "p_email": string }; Returns: string
                           },
"book_slot":
{ Args: { "p_lead": string,"p_starts": string,"p_tz"?: string }; Returns: {
              "assigned_to": string | null,
"cancelled_at": string | null,
"created_at": string,
"ends_at": string,
"id": string,
"lead_id": string,
"starts_at": string,
"status": Database["public"]['Enums']["booking_status"],
"timezone": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "bookings"
        isOneToOne: true
        isSetofReturn: false
      } },
"claim_events":
{ Args: { "p_limit"?: number }; Returns: {
              "attempts": number,
"channel": Database["public"]['Enums']["event_channel"],
"created_at": string,
"dedupe_key": string | null,
"delivered_at": string | null,
"id": string,
"last_error": string | null,
"lead_id": string | null,
"locked_at": string | null,
"next_attempt_at": string,
"payload": NonNullable<Json>,
"status": Database["public"]['Enums']["event_status"],
"type": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "events"
        isOneToOne: false
        isSetofReturn: true
      } },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"next_case_ref":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"owns_lead":
{ Args: { "p_lead": string }; Returns: boolean
                           },
"rate_limit_hit":
{ Args: { "p_key": string,"p_max": number,"p_window": number }; Returns: boolean
                           },
"revoke_user_sessions":
{ Args: { "p_user": string }; Returns: undefined
                           },
"safe_uuid":
{ Args: { "p_text": string }; Returns: string
                           },
"setting_text":
{ Args: { "p_default": string,"p_key": string }; Returns: string
                           }
          }
          Enums: {
            "booking_status": "confirmed"|"cancelled"|"completed"|"no_show","doc_status": "missing"|"requested"|"received"|"reupload","event_channel": "crm"|"email","event_status": "pending"|"processing"|"sent"|"failed"|"dead","inbox_status": "new"|"in_progress"|"closed","lead_route": "germany"|"austria"|"both"|"unsure","lead_stage": "lead"|"account"|"application"|"review"|"filed"|"granted","lead_status": "enquiry"|"account_created"|"application_incomplete"|"application_submitted"|"under_review"|"info_required"|"review_completed"|"contacting","locale_code": "en"|"he","sequence_status": "queued"|"sent"|"skipped","staff_role": "admin"|"lawyer"|"case_manager"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "booking_status": ["confirmed", "cancelled", "completed", "no_show"],"doc_status": ["missing", "requested", "received", "reupload"],"event_channel": ["crm", "email"],"event_status": ["pending", "processing", "sent", "failed", "dead"],"inbox_status": ["new", "in_progress", "closed"],"lead_route": ["germany", "austria", "both", "unsure"],"lead_stage": ["lead", "account", "application", "review", "filed", "granted"],"lead_status": ["enquiry", "account_created", "application_incomplete", "application_submitted", "under_review", "info_required", "review_completed", "contacting"],"locale_code": ["en", "he"],"sequence_status": ["queued", "sent", "skipped"],"staff_role": ["admin", "lawyer", "case_manager"]
          }
        }
} as const
