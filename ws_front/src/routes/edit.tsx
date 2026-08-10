import { createFileRoute, useSearch } from '@tanstack/react-router';
import { EditPage } from '#/Pages/Edit';

function EditRoute() {
  const { id } = useSearch({ from: '/edit' });
  return <EditPage id={String(id)} />;
}

export const Route = createFileRoute('/edit')({
  validateSearch: (search: Record<string, unknown>) => ({
    id: search.id,
  }),
  component: EditRoute,
});
