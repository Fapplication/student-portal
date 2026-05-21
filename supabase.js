import { createClient }
from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://pkdzcvfbcbilflrdfagt.supabase.co/rest/v1/'
const supabaseKey = 'YOUR_ANON_KEY'

export const supabase =
createClient(supabaseUrl, supabaseKey)
