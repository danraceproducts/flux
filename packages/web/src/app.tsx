import Router from 'preact-router'
import { ProjectCreate, ProjectList, Board, Webhooks, Products, Customers } from './pages'
import { ThemeProvider } from './components'

export function App() {
  return (
    <ThemeProvider>
      <Router>
        <ProjectList path="/" />
        <ProjectCreate path="/new" />
        <Board path="/board/:projectId" />
        <Webhooks path="/webhooks" />
        <Products path="/products" />
        <Customers path="/customers" />
      </Router>
    </ThemeProvider>
  )
}
