import { useEffect, useLayoutEffect } from 'react'

const isBrowser = Boolean(globalThis?.document)

export const useSafeLayoutEffect = isBrowser ? useLayoutEffect : useEffect
