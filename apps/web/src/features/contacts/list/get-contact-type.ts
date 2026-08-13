import { z } from 'zod'

export const contactTypes = [
  {
    id: 'all',
    label: 'All',
    href: '/',
  },
  {
    id: 'leads',
    label: 'Leads',
    href: '/leads',
  },
  {
    id: 'customers',
    label: 'Customers',
    href: '/customers',
  },
] as const

/**
 * Get the contact type by id. Returns `all` if the id is not found.
 *
 * @param id - The id of the contact type.
 * @returns The contact type.
 */
export const getContactType = (id: string) => {
  return contactTypes.find((type) => type.id === id) || contactTypes[0]
}

export const ZContactTypeEnum = z.enum(['leads', 'customers'])

export type ContactTypeEnum = z.infer<typeof ZContactTypeEnum>
