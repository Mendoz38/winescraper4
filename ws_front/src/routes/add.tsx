import { createFileRoute } from '@tanstack/react-router';
import { AddPage } from '#/Pages/Edit';

export const Route = createFileRoute('/add')({
  component: AddPage,
});
