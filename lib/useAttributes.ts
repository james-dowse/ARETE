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

export function useAttributes() {
  const [data, setData] = useState<AttributesData | null>(_cache)
  const [loading, setLoading] = useState(!_cache)

  useEffect(() => {
    if (!_cache) {
      fetch('/api/attributes')
        .then(r => r.json())
        .then((d: AttributesData) => {
          _cache = d
          setData(d)
          setLoading(false)
        })
    }
  }, [])

  const reload = async () => {
    invalidateAttributesCache()
    setLoading(true)
    const d: AttributesData = await fetch('/api/attributes').then(r => r.json())
    _cache = d
    setData(d)
    setLoading(false)
  }

  return {
    bioTypes: data?.bioTypes ?? [],
    complexities: data?.complexities ?? [],
    equipments: data?.equipments ?? [],
    loading,
    reload,
  }
}
