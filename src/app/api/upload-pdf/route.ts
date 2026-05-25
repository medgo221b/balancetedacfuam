import { NextResponse } from 'next/server'
import { parseBankStatement } from '@/lib/parser'
import { supabase } from '@/lib/supabaseClient'

const pdf = require('pdf-parse-fork')

export const runtime = 'nodejs'; 

export async function POST(request: Request) {

  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    const allProcessed = []
    const errors = []

    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const data = await pdf(buffer)
        
        const transactions = parseBankStatement(data.text)
        
        const transactionsWithSource = transactions.map(t => ({
          ...t,
          source_file: file.name
        }))

        if (transactionsWithSource.length > 0) {
          const { error: insertError } = await supabase
            .from('transactions')
            .upsert(transactionsWithSource, { 
              onConflict: 'operation_id,date,amount,description' 
            })

          if (insertError) {
            errors.push({ file: file.name, error: 'Erro no banco', details: insertError })
          } else {
            allProcessed.push({ file: file.name, count: transactionsWithSource.length })
          }
        }
      } catch (err: any) {
        errors.push({ file: file.name, error: err.message })
      }
    }

    return NextResponse.json({ success: true, processed: allProcessed, errors })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
