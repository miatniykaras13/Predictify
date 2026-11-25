import { Link, NavLink, Outlet } from 'react-router';

export function AppLayout() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Перейти к содержимому
      </a>
      <header className="app-header">
        <div className="container app-header__inner">
          <Link className="brand" to="/events">
            Predictify
          </Link>
          <nav className="main-nav" aria-label="Основная навигация">
            <NavLink to="/events">События</NavLink>
            <NavLink to="/leaderboard">Рейтинг</NavLink>
          </nav>
        </div>
      </header>
      <main className="container app-main" id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </>
  );
}
