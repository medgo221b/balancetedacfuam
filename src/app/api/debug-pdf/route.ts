import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Using pdf-parse-fork which is more stable in Node environments
const pdf = require('pdf-parse-fork')

export async function GET() {
  const publicDir = path.join(process.cwd(), 'public')
  const files = fs.readdirSync(publicDir).filter(f => f.toLowerCase().endsWith('.pdf'))
  
  const results = []

  for (const file of files) {
    const filePath = path.join(publicDir, file)
    
    try {
      const dataBuffer = fs.readFileSync(filePath)
      const data = await pdf(dataBuffer)
      
      results.push({
        file,
        preview: data.text.substring(0, 1500)
      })
    } catch (error: any) {
      console.error(`Error parsing ${file}:`, error)
      results.push({ 
        file, 
        error: 'Failed to parse PDF',
        details: error?.message || 'Unknown error'
      })
    }
  }

  return NextResponse.json(results)
}
