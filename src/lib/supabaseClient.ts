import { createClient } from '@supabase/supabase-js';

// Your values from Supabase:
const supabaseUrl = 'https://gzloumyomschdfkyqwed.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6bG91bXlvbXNjaGRma3lxd2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxOTU3MjksImV4cCI6MjA2MTc3MTcyOX0.ads-bLptByNMNKVzzuDwEh6_JQcN0OcW1wT7pOQadDg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);