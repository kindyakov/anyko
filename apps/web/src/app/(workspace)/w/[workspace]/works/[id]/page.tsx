import { WorkScreen } from './_screen/work-screen';

export default async function WorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WorkScreen key={id} workId={id} />;
}
