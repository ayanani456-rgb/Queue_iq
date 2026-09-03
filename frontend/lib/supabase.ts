import { createClient } from '@supabase/supabase-js'

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://queueiq-backend-production.up.railway.app"

// TODO: Ayan se ye 2 cheez leke yahan daal do
const SUPABASE_URL = "https://nwrfpdwacfxttxfjwzxx.supabase.co"
const SUPABASE_ANON_KEY = "sb_publishable_zjRmE547dWVVd1Q54uIDNQ_QpX5CqIk"

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Change 1: Real functions
export async function fetchRealDoctors() {
  const { data, error } = await supabase.from('doctors').select('*')
  if (error) {
    console.error("Supabase doctors error:", error)
    return null
  }
  return data
}

export async function fetchRealDepartments() {
  const { data, error } = await supabase.from('departments').select('*')
  if (error) {
    console.error("Supabase departments error:", error)
    return null
  }
  return data
}

export async function realLogin(email: string, password: string) {
  const { data, error } = await supabase.rpc('login', { email, password } as any)
  if (error) {
    console.error("Login error:", error)
    return { error }
  }
  return { data }
}

// Change 3: Queue functions
export async function getTokenStatus(tokenId: string) {
  const res = await fetch(`${API_URL}/api/tokens/status/${tokenId}`)
  return res.json()
}

export async function getDoctorQueue(doctorId: string) {
  const res = await fetch(`${API_URL}/api/business/tokens?doctorId=${doctorId}`)
  return res.json()
}

export async function callNextToken(doctorId: string) {
  const res = await fetch(`${API_URL}/api/business/call-next`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doctorId })
  })
  return res.json()
}
