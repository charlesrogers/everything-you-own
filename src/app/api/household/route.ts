import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/household — return household info + members
 * POST /api/household — create invite link
 * DELETE /api/household?memberId=xxx — remove a member
 */
export async function GET() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await sb
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) return NextResponse.json({ error: 'No household' }, { status: 403 })

  const hid = membership.household_id

  const [{ data: household }, { data: members }, { data: invites }] = await Promise.all([
    sb.from('households').select('id, name, created_at').eq('id', hid).single(),
    sb.from('household_members').select('id, user_id, role, display_name, joined_at').eq('household_id', hid).order('joined_at'),
    sb.from('household_invites').select('id, invite_code, created_at, expires_at, used_by, used_at').eq('household_id', hid).order('created_at', { ascending: false }).limit(10),
  ])

  return NextResponse.json({
    household,
    members: members ?? [],
    invites: (invites ?? []).filter((i) => !i.used_by && new Date(i.expires_at) > new Date()),
    currentUserRole: membership.role,
  })
}

export async function POST(request: NextRequest) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await sb
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) return NextResponse.json({ error: 'No household' }, { status: 403 })

  const body = await request.json()

  if (body.action === 'create_invite') {
    const { data, error } = await sb
      .from('household_invites')
      .insert({
        household_id: membership.household_id,
        created_by: user.id,
      })
      .select('invite_code')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ invite_code: data.invite_code })
  }

  if (body.action === 'update_name') {
    if (membership.role !== 'owner') {
      return NextResponse.json({ error: 'Only owners can rename the household' }, { status: 403 })
    }
    const { error } = await sb
      .from('households')
      .update({ name: body.name })
      .eq('id', membership.household_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function DELETE(request: NextRequest) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await sb
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    return NextResponse.json({ error: 'Only owners/admins can remove members' }, { status: 403 })
  }

  const memberId = request.nextUrl.searchParams.get('memberId')
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  // Can't remove yourself
  const { data: target } = await sb
    .from('household_members')
    .select('user_id, role')
    .eq('id', memberId)
    .eq('household_id', membership.household_id)
    .single()

  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (target.user_id === user.id) return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })
  if (target.role === 'owner') return NextResponse.json({ error: 'Cannot remove the owner' }, { status: 400 })

  const { error } = await sb
    .from('household_members')
    .delete()
    .eq('id', memberId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
