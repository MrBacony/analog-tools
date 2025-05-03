export function getLastPathSegment(path: string): string {
    // Erstellen Sie ein URL-Objekt, um den Pfad zu analysieren
    const url = new URL(path, 'http://dummy-base'); // Basis-URL erforderlich für relative Pfade

    // Extrahieren Sie den Pfadnamen und teilen Sie ihn in Segmente
    const segments = url.pathname.split('/').filter(Boolean);

    // Geben Sie den letzten Pfadabschnitt zurück
    return segments.pop() ?? '';
}
