'use client'

import React, { useMemo } from 'react'

import { useStore } from 'zustand'

import { createFeaturesStore } from './store'
import { Segment, UserAttributes } from './types'

export interface FeaturesOptions {
  segments: Segment[]
  attr?: UserAttributes
}

const FeaturesContext = React.createContext<ReturnType<
  typeof createFeaturesStore
> | null>(null)

const useFeaturesContext = () => React.useContext(FeaturesContext)

export interface FeaturesProviderProps {
  value?: FeaturesOptions
  children: React.ReactNode
}

/**
 * Initialize the feature flags provider.
 */
const initFeatures = (
  store: ReturnType<typeof createFeaturesStore>,
  options: FeaturesOptions,
) => {
  const state = store.getState()

  store.setState({ segments: options.segments, isReady: true })

  const attr = options.attr || state.attr
  if (attr) {
    store.getState().identify(attr)
  }
}

export const FeaturesProvider: React.FC<FeaturesProviderProps> = (props) => {
  const { children, value } = props

  const store = useMemo(() => createFeaturesStore(), [])

  React.useEffect(() => {
    if (value) {
      initFeatures(store, value)
    }
  }, [store, value])

  return (
    <FeaturesContext.Provider value={store}>
      {children}
    </FeaturesContext.Provider>
  )
}

export const useFeatures = () => {
  const context = useFeaturesContext()

  if (!context) {
    throw new Error(
      'Features context missing, did you wrap your app with FeaturesProvider?',
    )
  }

  return useStore(context)
}

/**
 * Check if the current identified user has one or more features.
 */
export const useHasFeature = (
  feature: string | string[] = [],
  value = true,
) => {
  const ids = typeof feature === 'string' ? [feature] : feature

  const { hasFeatures, flags } = useFeatures()

  return React.useMemo(() => {
    return hasFeatures(ids, value)
  }, [flags, ids])
}

/**
 * Return all flags for the current identified user.
 * @returns The feature flags
 */
export const useFlags = () => {
  const { flags } = useFeatures()
  return flags
}

/**
 * Return the value of a feature flag if it exists.
 * @param id The feature id
 * @returns The feature value
 */
export const useFlag = (id: string) => {
  const { flags } = useFeatures()
  return flags[id]
}
