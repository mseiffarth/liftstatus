// app/index.tsx
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { initializeApp } from 'firebase/app';
import { getDatabase, onValue, ref, Unsubscribe } from 'firebase/database';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import '../tasks/location-task'; // ensure background task is registered

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAzTqZRmmqGIAdK1nMzCmYnzUDl9wXqB44",
  authDomain: "londonliftsstatus.firebaseapp.com",
  databaseURL: "https://londonliftsstatus-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "londonliftsstatus",
  storageBucket: "londonliftsstatus.firebasestorage.app",
  messagingSenderId: "1087365913726",
  appId: "1:1087365913726:web:ae737aaba23471fc198c2f",
  measurementId: "G-4DL3HKTMN6"
};
const distanceIntervalMetres = 100; //m
const timeIntervalMSeconds = 300000; //ms
initializeApp(firebaseConfig);
const db = getDatabase();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Tunnel enum
enum Tunnel {
  Greenwich = 'greenwich',
  Woolwich = 'woolwich',
}

const tunnelLabels: Record<Tunnel, string> = {
  [Tunnel.Greenwich]: 'Greenwich Foot Tunnel',
  [Tunnel.Woolwich]: 'Woolwich Foot Tunnel',
};

type LiftStatus = { north: boolean; south: boolean };
type TunnelStatus = Partial<Record<Tunnel, LiftStatus>>;

export default function App() {
  const [status, setStatus] = useState<TunnelStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ensureNotificationPermissions = async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Lift alerts',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      const settings = await Notifications.getPermissionsAsync();
      if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
        return;
      }

      const { status: permissionStatus } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: false,
          allowSound: true,
        },
      });

      if (permissionStatus !== 'granted') {
        console.warn('Notification permission not granted');
      }
    };

    ensureNotificationPermissions();
  }, []);

  useEffect(() => {
    const statusRef = ref(db, 'liftStatus');
    let isMounted = true;

    const unsubscribe: Unsubscribe = onValue(
      statusRef,
      (snapshot) => {
        if (!isMounted) return;
        const data = snapshot.val();
        console.log('Firebase data:', data);
        setStatus(data);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Firebase read failed:', err);
        if (!isMounted) return;
        setError('Could not load lift status right now.');
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const startBackgroundLocation = async () => {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        console.warn('Foreground location permission not granted');
        return;
      }

      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        console.warn('Background location permission not granted');
        return;
      }

      const isRunning = await Location.hasStartedLocationUpdatesAsync('tunnel-location-task');
      if (!isRunning) {
        await Location.startLocationUpdatesAsync('tunnel-location-task', {
          accuracy: Location.Accuracy.High,
          distanceInterval: distanceIntervalMetres, // meters
          timeInterval: timeIntervalMSeconds,  // ms
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Lift Status running',
            notificationBody: 'Tracking your location to check lift availability.',
          },
          pausesUpdatesAutomatically: false,
          activityType: Location.LocationActivityType.Other,
          deferredUpdatesDistance: 50,
          deferredUpdatesInterval: 120000,
          mayShowUserSettingsDialog: true,
        });
      }
    };

    if (Platform.OS !== 'web') {
      startBackgroundLocation();
    }
  }, []);

  const tunnelStatus = useMemo(
    () =>
      Object.values(Tunnel).map((tunnel) => ({
        id: tunnel,
        label: tunnelLabels[tunnel],
        lifts: status?.[tunnel] ?? null,
      })),
    [status]
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="black" />
        <Text style={styles.loadingText}>Fetching lift status…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.secondaryText}>Pull to refresh or try again shortly.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>London Foot Tunnel Lifts</Text>
      {tunnelStatus.map(({ id, label, lifts }) => (
        <View key={id} style={styles.block}>
          <Text style={styles.header}>{label}</Text>
          {lifts ? (
            <>
              <Text style={styles.statusLine}>North lift: {lifts.north ? '✅ Open' : '❌ Closed'}</Text>
              <Text style={styles.statusLine}>South lift: {lifts.south ? '✅ Open' : '❌ Closed'}</Text>
            </>
          ) : (
            <Text style={styles.secondaryText}>No data received yet.</Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 24,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 24,
  },
  heading: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    color: 'black',
  },
  header: { fontSize: 18, fontWeight: '600', marginBottom: 8, color: 'black', textAlign: 'center' },
  block: {
    padding: 18,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statusLine: { fontSize: 16, color: 'black', marginBottom: 4, textAlign: 'center' },
  secondaryText: { fontSize: 14, color: '#555', textAlign: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#333' },
  errorText: { fontSize: 16, color: '#b00020', textAlign: 'center', marginBottom: 8 },
});
