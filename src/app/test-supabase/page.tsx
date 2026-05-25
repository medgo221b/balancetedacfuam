'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function TestSupabase() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function checkConnection() {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('id')
          .limit(1)

        if (error) {
          setStatus('error')
          setMessage(error.message)
        } else {
          setStatus('success')
          setMessage('Conexão com Supabase estabelecida com sucesso!')
        }
      } catch (err) {
        setStatus('error')
        setMessage('Erro inesperado ao conectar.')
        console.error(err)
      }
    }

    checkConnection()
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24 font-sans">
      <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-black">
        <h1 className="mb-4 text-2xl font-bold">Teste de Conexão Supabase</h1>
        
        {status === 'loading' && (
          <p className="text-zinc-600 dark:text-zinc-400">Verificando conexão...</p>
        )}

        {status === 'success' && (
          <div className="flex flex-col gap-2">
            <p className="font-medium text-green-600 dark:text-green-400">✓ {message}</p>
            <p className="text-sm text-zinc-500">A tabela `transactions` foi encontrada.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col gap-2">
            <p className="font-medium text-red-600 dark:text-red-400">✗ Erro na conexão</p>
            <p className="text-sm text-zinc-500">{message}</p>
            <p className="mt-4 text-xs text-zinc-400 italic">
              Dica: Verifique se você executou o SQL no painel do Supabase.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
