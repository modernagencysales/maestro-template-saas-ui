import { config } from '#config'

export const logo = {
  borderRadius: 21,
  width: 42,
  height: 42,
}

export const body = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
}

export const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '560px',
}

export const heading = {
  fontSize: '24px',
  letterSpacing: '-0.5px',
  lineHeight: '1.3',
  fontWeight: '400',
  color: '#484848',
  padding: '17px 0 0',
}

export const paragraph = {
  margin: '0 0 15px',
  fontSize: '15px',
  lineHeight: '1.4',
  color: '#3c4149',
}

export const buttonContainer = {
  padding: '27px 0 27px',
}

export const button = {
  backgroundColor: config.colors.brand,
  borderRadius: '3px',
  fontWeight: '600',
  color: '#fff',
  fontSize: '15px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '11px 23px',
}

export const reportLink = {
  fontSize: '14px',
  color: '#b4becc',
}

export const hr = {
  borderColor: '#dfe1e4',
  margin: '42px 0 26px',
}

export const code = {
  fontFamily: 'monospace',
  fontWeight: '700',
  padding: '1px 4px',
  backgroundColor: '#dfe1e4',
  letterSpacing: '-0.3px',
  fontSize: '21px',
  borderRadius: '6px',
  color: '#3c4149',
}
