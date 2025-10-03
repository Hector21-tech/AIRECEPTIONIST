import { getTeamForUser } from '@/lib/db/queries';

export async function GET() {
  const team = await getTeamForUser();

  if (!team) {
    return Response.json({ error: 'Unauthorized or team not found' }, { status: 401 });
  }

  return Response.json(team);
}
