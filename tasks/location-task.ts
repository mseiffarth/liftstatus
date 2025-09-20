import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

const TRIGGER_DISTANCE = 30; // metres
const NOTIFICATION_COOLDOWN_MS = 30 * 60 * 1000; // 30 mins
const tunnelEntrances = [
  { name: 'greenwich-north', lat: 51.4842, lon: -0.0097 },
  { name: 'greenwich-south', lat: 51.4820, lon: -0.0081 },
  { name: 'woolwich-north', lat: 51.4926, lon: 0.0692 },
  { name: 'woolwich-south', lat: 51.4902, lon: 0.0682 },
];

const lastAlertTimestamps: Record<string, number> = {};

const formatTunnelName = (rawName: string): string =>
  rawName
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (x: number) => x * Math.PI / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

TaskManager.defineTask('tunnel-location-task', async ({ data, error }) => {
  if (error || !data) {
    console.error('Location task error:', error);
    return;
  }

  const { locations } = data as any;
  if (!locations || locations.length === 0) return;

  const { latitude, longitude } = locations[0].coords;

  // Track whether a notification was sent to avoid spamming
  await Promise.all(
    tunnelEntrances.map(async (tunnel) => {
      const distanceKm = haversineDistance(latitude, longitude, tunnel.lat, tunnel.lon);
      const distanceMetres = distanceKm * 1000;
      const now = Date.now();

      if (distanceMetres > TRIGGER_DISTANCE) {
        return;
      }

      const lastAlert = lastAlertTimestamps[tunnel.name] ?? 0;
      if (now - lastAlert < NOTIFICATION_COOLDOWN_MS) {
        return;
      }

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Approaching ${formatTunnelName(tunnel.name)} Foot Tunnel`,
            body: 'Check if the lifts are running before you head down.',
          },
          trigger: null,
        });
        lastAlertTimestamps[tunnel.name] = now;
      } catch (notifError) {
        console.error('Failed to schedule tunnel notification', notifError);
      }
    })
  );
});
