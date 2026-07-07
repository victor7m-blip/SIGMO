<main className={route === 'materiais' ? 'main main-fullscreen' : 'main'}>
  {route !== 'materiais' && (
    <header className="topbar">
      ...
    </header>
  )}

  {children}
</main>