import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Server-side route needs direct API URL, not the domain proxy
const SUPABASE_URL = process.env.SUPABASE_API_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortId: string }> }
) {
  const { shortId } = await params

  const supabase = createClient(
    SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error } = await supabase
    .from('locations')
    .select('id')
    .eq('short_id', shortId)
    .maybeSingle()

  if (error) {
    console.error('Scan lookup failed:', error.message)
  }

  return NextResponse.json({ locationId: data?.id ?? null })
}
