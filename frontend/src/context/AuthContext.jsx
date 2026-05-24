import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

const API = 'https://apigw.notiovation.com/notioportal'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  // Load token from localStorage on mount and validate via API
  useEffect(() => {
    const savedToken = localStorage.getItem('bk_token')
    if (savedToken) {
      setToken(savedToken)
      fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${savedToken}` },
      })
        .then(res => {
          if (!res.ok) throw new Error('Token invalid')
          return res.json()
        })
        .then(data => {
          setUser(data.PENGGUNA || data)
        })
        .catch(() => {
          localStorage.removeItem('bk_token')
          setToken(null)
          setUser(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const saveAuth = useCallback((newToken, newUser) => {
    localStorage.setItem('bk_token', newToken)
    setToken(newToken)
    setUser(newUser)
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || err.error || 'Login gagal')
    }
    const data = await res.json()
    saveAuth(data.TOKEN, data.PENGGUNA)
    return data
  }, [saveAuth])

  const loginWithGoogle = useCallback(async (credential) => {
    const res = await fetch(`${API}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || err.error || 'Login Google gagal')
    }
    const data = await res.json()
    saveAuth(data.TOKEN, data.PENGGUNA)
    return data
  }, [saveAuth])

  const register = useCallback(async (email, password, name) => {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || err.error || 'Registrasi gagal')
    }
    const data = await res.json()
    saveAuth(data.TOKEN, data.PENGGUNA)
    return data
  }, [saveAuth])

  const logout = useCallback(() => {
    localStorage.removeItem('bk_token')
    setToken(null)
    setUser(null)
  }, [])

  const isAdmin = user?.ROLE === 'admin'

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, loginWithGoogle, register, logout,
      isAdmin
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
