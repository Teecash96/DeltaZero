# Phase 0 database foundation

`schema.prisma` is the minimal Postgres model for agents, risk reports, jobs,
and payments. It is intentionally not connected to the existing production
application in Phase 0.

Validate it with Prisma 6 while `DATABASE_URL` is set:

```bash
DATABASE_URL='postgresql://user:password@localhost:5432/deltazero' \
  npx prisma@6.19.0 validate --schema prisma/schema.prisma
```

Migrations and a Prisma client are deferred until the marketplace data layer
is introduced.
