import { getUser, getTeamForUser } from './lib/db/queries';

async function debugAPI() {
  console.log('🔍 DEBUGGING API CALLS...\n');

  try {
    console.log('1. Testing getUser()...');
    const user = await getUser();
    console.log('User result:', user ? `${user.email} (ID: ${user.id})` : 'null');

    if (user) {
      console.log('\n2. Testing getTeamForUser()...');
      const team = await getTeamForUser();
      console.log('Team result:', team ? `${team.name} (ID: ${team.id})` : 'null');

      if (team) {
        console.log('Team members:', team.teamMembers.length);
        team.teamMembers.forEach(m =>
          console.log(`  - ${m.user.email} as ${m.role}`)
        );
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run if called directly
if (require.main === module) {
  debugAPI().catch(console.error);
}

export default debugAPI;