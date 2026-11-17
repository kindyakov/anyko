import { WorkDetail } from '@/features/works';

export default async function WorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WorkDetail key={id} workId={id} />;
}
