import type { IconType } from 'react-icons'
import { FaGoogleDrive, FaSlack } from 'react-icons/fa6'
import { SiHubspot } from 'react-icons/si'

export type ConnectionStatus =
  | 'available'
  | 'connecting'
  | 'connected'
  | 'error'

export type DurableConnection = Readonly<{
  provider: ConnectionCardModel['id']
  status: 'authorizing' | 'verifying' | 'active' | 'error' | 'revoked'
  generation: number
}>

export type ConnectionCardModel = Readonly<{
  id: 'slack' | 'google-drive' | 'hubspot'
  name: string
  description: string
  icon: IconType
  docs: string
  status: ConnectionStatus
}>

export const connectionFixtures: readonly ConnectionCardModel[] = [
  {
    id: 'slack',
    name: 'Slack',
    description:
      'Bring client conversations and channel context into the Agency Brain.',
    icon: FaSlack,
    docs: 'https://api.slack.com/docs',
    status: 'connected',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description:
      'Use approved documents and folders as source material for client work.',
    icon: FaGoogleDrive,
    docs: 'https://developers.google.com/drive',
    status: 'available',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description:
      'Connect customer and pipeline context without copying it into a second UI.',
    icon: SiHubspot,
    docs: 'https://developers.hubspot.com/docs',
    status: 'available',
  },
]

export const transitionConnectionStatus = (
  status: ConnectionStatus,
  event: 'connect' | 'disconnect',
): ConnectionStatus => (event === 'connect' ? 'connected' : 'available')

export const projectDurableConnectionStatus = (
  connection: DurableConnection | undefined,
): ConnectionStatus => {
  if (connection?.status === 'active') return 'connected'
  if (
    connection?.status === 'authorizing' ||
    connection?.status === 'verifying'
  ) {
    return 'connecting'
  }
  if (connection?.status === 'error') return 'error'
  return 'available'
}
