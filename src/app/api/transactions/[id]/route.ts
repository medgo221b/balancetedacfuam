import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { password } = await request.json()
    const adminPassword = process.env.ADMIN_PASSWORD

    if (!adminPassword || password !== adminPassword) {
      return NextResponse.json({ error: 'Senha administrativa incorreta' }, { status: 401 })
    }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { password, ...updates } = await request.json()
    const adminPassword = process.env.ADMIN_PASSWORD

    if (!adminPassword || password !== adminPassword) {
      return NextResponse.json({ error: 'Senha administrativa incorreta' }, { status: 401 })
    }

    const { error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
