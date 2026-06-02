import { createFileRoute } from '@tanstack/react-router'
import { EditPage } from '#/Pages/Edit'

export const Route = createFileRoute('/edit')({
  validateSearch: (search: Record<string, unknown>) => ({
    id: search.id,
  }),
  component: EditPage,
})
