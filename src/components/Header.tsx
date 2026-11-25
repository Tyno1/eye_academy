import { Link } from '@tanstack/react-router'
import { Eye, LogOut } from 'lucide-react'
import { useAuth } from '../providers/auth-context'
import ThemeToggle from './ThemeToggle'

export default function Header() {
  const { email, signedIn, signOut } = useAuth()

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/92 px-4 backdrop-blur-lg">
      <nav className="page-wrap flex flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:py-4">
        <h2 className="m-0 flex-shrink-0 text-base font-semibold tracking-tight">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card px-3 py-1.5 text-sm text-foreground no-underline shadow-[0_8px_24px_rgba(15,23,42,0.08)] sm:px-4 sm:py-2"
          >
            <Eye className="size-4 text-primary" aria-hidden />
            Eye Academy
          </Link>
        </h2>

        <div className="order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 pb-1 text-sm font-semibold sm:order-none sm:w-auto sm:flex-nowrap sm:pb-0">
          <Link
            to="/"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
          >
            Home
          </Link>
          {signedIn ? (
            <Link
              to="/viva"
              className="nav-link"
              activeProps={{ className: 'nav-link is-active' }}
            >
              Viva
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="nav-link"
                activeProps={{ className: 'nav-link is-active' }}
              >
                Login
              </Link>
              <Link
                to="/register"
                className="nav-link"
                activeProps={{ className: 'nav-link is-active' }}
              >
                Register
              </Link>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {signedIn ? (
            <>
              {email ? (
                <span className="max-w-40 truncate text-sm text-muted-foreground">
                  {email}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => void signOut()}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-card px-3 py-1.5 text-sm font-semibold text-foreground"
              >
                <LogOut className="size-4" aria-hidden />
                Sign out
              </button>
            </>
          ) : null}
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
