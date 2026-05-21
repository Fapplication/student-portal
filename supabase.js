import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://pkdzcvfbcbilflrdfagt.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrZHpjdmZiY2JpbGZscmRmYWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMjk3ODQsImV4cCI6MjA5NDkwNTc4NH0.KOH29kS9Dm6SD5f8x8TZOIUYDAzv3SSEw3Blq8fRGdc"

export const supabase = createClient(supabaseUrl, supabaseKey)
