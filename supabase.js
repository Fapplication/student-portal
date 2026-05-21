import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://pkdzcvfbcbilflrdfagt.supabase.co"
const supabaseKey = "sb_publishable_zaImYNwzo_Zjbt5rknuO5A_h01sKFTy"

export const supabase = createClient(supabaseUrl, supabaseKey)
