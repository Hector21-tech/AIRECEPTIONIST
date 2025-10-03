import { getUser } from '@/lib/db/queries';

export async function GET() {
  const user = await getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return Response.json(user);
}
