import { createFileRoute } from '@tanstack/react-router';
import { AddPage } from '#/Pages/Add';

export const Route = createFileRoute('/add')({
  component: AddPage,
});
