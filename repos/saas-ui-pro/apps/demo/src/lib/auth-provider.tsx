'use client'

import * as React from 'react'

export interface AuthParams {
  email?: string
  password?: string
  provider?: string
  [key: string]: unknown
}

export interface User {
  [key: string]: any
}

export interface AvailableProviders {
  [key: string]: {
    icon: React.ElementType
    name: string
  }
}

interface AuthProviderProps {
  onLoadUser?: () => Promise<User | null>
  onLogin?: (params: AuthParams) => Promise<User | null | undefined>
  onSignup?: (params: AuthParams) => Promise<User | null | undefined>
  onLogout?: () => Promise<unknown>
  onGetToken?: () => Promise<string | null | undefined>
  children: React.ReactNode
}

interface AuthContextValue {
  isAuthenticated: boolean
  isLoggingIn: boolean
  isLoading: boolean
  user?: User | null
  logIn: (params: AuthParams) => Promise<User | null | undefined>
  signUp: (params: AuthParams) => Promise<User | null | undefined>
  logOut: () => Promise<unknown>
  loadUser: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider(props: AuthProviderProps) {
  const {
    onLoadUser = () => Promise.resolve(null),
    onLogin = () => Promise.resolve(null),
    onSignup = () => Promise.resolve(null),
    onLogout = () => Promise.resolve(),
    onGetToken,
    children,
  } = props

  const [user, setUser] = React.useState<User | null>()
  const [isLoading, setIsLoading] = React.useState(true)
  const isFetching = React.useRef(false)

  const loadUser = React.useCallback(async () => {
    if (isFetching.current) return

    isFetching.current = true
    try {
      const hasSession = !onGetToken || (await onGetToken())
      setUser(hasSession ? await onLoadUser() : null)
    } finally {
      isFetching.current = false
      setIsLoading(false)
    }
  }, [onGetToken, onLoadUser])

  React.useEffect(() => {
    void loadUser()
  }, [loadUser])

  const logIn = React.useCallback(
    async (params: AuthParams) => {
      const result = await onLogin(params)
      await loadUser()
      return result
    },
    [loadUser, onLogin],
  )

  const signUp = React.useCallback(
    async (params: AuthParams) => {
      const result = await onSignup(params)
      await loadUser()
      return result
    },
    [loadUser, onSignup],
  )

  const logOut = React.useCallback(async () => {
    const result = await onLogout()
    setUser(null)
    return result
  }, [onLogout])

  const value = React.useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: !!user,
      isLoggingIn: false,
      isLoading,
      user,
      logIn,
      signUp,
      logOut,
      loadUser,
    }),
    [isLoading, loadUser, logIn, logOut, signUp, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth<TUser extends User = User>() {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context as Omit<AuthContextValue, 'user'> & { user?: TUser | null }
}
