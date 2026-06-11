'use client'
import { useState, useEffect } from 'react'

export interface AttributeOption {
  id: string
  category: string
  value: string
  icon: string | null
  color: string | null
  position: number
}

export interface AttributesData {
  bioTypes: AttributeOption[]
  complexities: AttributeOption[]
  equipments: AttributeOption[]
}

let _cache: AttributesData | null = null

export function invalidateAttributesCache() {
  _cache = null
}

async function fetchAttributes(): Promise<AttributesData> {
  const r = await fetch('/api/attributes')
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

export function useAttributes() {
  const [data, setData] = useState<AttributesData | null>(_cache)
  const [loading, setLoading] = useState(!_cache)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!_cache) {
      fetchAttributes()
        .then(d => { _cache = d; setData(d); setLoading(false) })
        .catch(e => { setError(String(e)); setLoading(false) })
    }
  }, [])

  // Silent reload — does NOT set loading = true, avoids skeleton flash
  const reload = async () => {
    invalidateAttributesCache()
    try {
      const d = await fetchAttributes()
      _cache = d
      setData(d)
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }

  return {
    bioTypes: data?.bioTypes ?? [],
    complexities: data?.complexities ?? [],
    equipments: data?.equipments ?? [],
    loading,
    error,
    reload,
  }
}
