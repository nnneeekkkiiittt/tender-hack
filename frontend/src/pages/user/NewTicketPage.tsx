// Compatibility entry point: every new claim starts in the same chat.
import { Navigate } from 'react-router-dom'
export function NewTicketPage() {
  return <Navigate to="/app" replace />
}
