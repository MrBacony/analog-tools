export default async function globalSetup() {
  const keycloakUrl =
    'http://localhost:8080/realms/dev/.well-known/openid-configuration';

  try {
    const response = await fetch(keycloakUrl);
    if (!response.ok) {
      throw new Error(`Keycloak returned ${response.status}`);
    }
    console.log('✓ Keycloak discovery endpoint reachable');
  } catch (error) {
    throw new Error(
      `Keycloak is not reachable at ${keycloakUrl}. ` +
        `Start it with: docker compose -f docker/docker-compose.yml up -d\n` +
        `Error: ${error}`
    );
  }
}
