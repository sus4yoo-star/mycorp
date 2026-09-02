'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@mycorp24/db';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

export const getBrowserClient = () =>
  createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
