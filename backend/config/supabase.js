import { createClient } from "@supabase/supabase-js";
import config from "./env.js";

const url = config.supabase?.url;
const anonKey = config.supabase?.anonKey;
const serviceRoleKey = config.supabase?.serviceRoleKey;

export const supabaseEnabled = Boolean(url && anonKey && serviceRoleKey);

export const supabaseAuthClient = supabaseEnabled
  ? createClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

export const supabaseAdmin = supabaseEnabled
  ? createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

export default {
  supabaseEnabled,
  supabaseAuthClient,
  supabaseAdmin,
};
