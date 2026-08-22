import * as React from 'react'

import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SidebarDarkMode } from './sidebar2-color-mode'

const colorMode = vi.hoisted(() => ({ value: 'light' as 'light' | 'dark' }))

vi.mock('#registry/default/setup/color-mode/color-mode', () => ({
  DarkMode: ({ children }: React.PropsWithChildren) => (
    <span className="chakra-theme dark" data-theme="dark">
      {children}
    </span>
  ),
  useColorMode: () => ({ colorMode: colorMode.value }),
}))

describe('SidebarDarkMode', () => {
  beforeEach(() => {
    colorMode.value = 'light'
  })

  it('adds an isolated dark theme boundary in light mode', () => {
    const html = renderToStaticMarkup(
      <SidebarDarkMode>
        <div>Sidebar</div>
      </SidebarDarkMode>,
    )

    expect(html).toContain('class="chakra-theme dark"')
    expect(html).toContain('data-theme="dark"')
  })

  it('does not add a redundant theme boundary in dark mode', () => {
    colorMode.value = 'dark'

    const html = renderToStaticMarkup(
      <SidebarDarkMode>
        <div>Sidebar</div>
      </SidebarDarkMode>,
    )

    expect(html).toBe('<div>Sidebar</div>')
  })
})
