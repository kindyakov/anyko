import { Workspace } from '@/app/workspace';
export default async function WorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Workspace workId={id} />;
}
