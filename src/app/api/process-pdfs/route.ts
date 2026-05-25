import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { parseBankStatement } from '@/lib/parser'
import { supabase } from '@/lib/supabaseClient'

// Using pdf-parse-fork which we already verified works
const pdf = require('pdf-parse-fork')

export async function GET() {
  const publicDir = path.join(process.cwd(), 'public')
  const files = fs.readdirSync(publicDir).filter(f => f.toLowerCase().endsWith('.pdf'))
  
  const allProcessed = []
  const errors = []

  for (const file of files) {
    try {
      const filePath = path.join(publicDir, file)
      const dataBuffer = fs.readFileSync(filePath)
      const data = await pdf(dataBuffer)
      
      const transactions = parseBankStatement(data.text)
      
      // Add source file info
      const transactionsWithSource = transactions.map(t => ({
        ...t,
        source_file: file
      }))

      if (transactionsWithSource.length > 0) {
        // Insert into Supabase
        // Note: Using upsert might be better if we have a unique constraint, 
        // but for now let's just insert.
        const { error: insertError } = await supabase
          .from('transactions')
          .insert(transactionsWithSource)

        if (insertError) {
          errors.push({ file, error: 'Database insert failed', details: insertError })
        } else {
          allProcessed.push({ 
            file, 
            count: transactionsWithSource.length 
          })
        }
      } else {
        allProcessed.push({ file, count: 0, warning: 'No transactions found in this file' })
      }

    } catch (error: any) {
      errors.push({ 
        file, 
        error: 'Failed to process file', 
        details: error?.message || 'Unknown error' 
      })
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    processed: allProcessed,
    errors: errors.length > 0 ? errors : undefined
  })
}
