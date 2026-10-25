# Routing boundary

Next.js pages, route handlers and responsive styles live here. The catch-all screen route accepts only the documented portal paths; the API gateway authorizes every protected request.

See `docs/integrations.md` for planned paths. Route handlers should parse and validate requests, resolve verified identity, call server services and serialize safe responses. Business rules belong in server services and database transactions.
