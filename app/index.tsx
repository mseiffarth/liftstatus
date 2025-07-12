// app/index.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';
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

// Tunnel enum
enum Tunnel {
  Greenwich = 'greenwich',
  Woolwich = 'woolwich',
}

type LiftStatus = { north: boolean; south: boolean };
type TunnelStatus = Record<Tunnel, LiftStatus>;

export default function App() {
  const [status, setStatus] = useState<TunnelStatus | null>(null);

  useEffect(() => {
    const statusRef = ref(db, 'liftStatus');
    onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      console.log('Firebase data:', data);
      setStatus(data);
    }, (error) => {
      console.error('Firebase read failed:', error);
    });
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
        });
      }
    };

    startBackgroundLocation();
  }, []);

  if (!status) return <Text style={styles.loading}>Loading...</Text>;

  return (
    <View style={styles.container}>
      {Object.values(Tunnel).map((tunnel) => (
        <View key={tunnel} style={styles.block}>
          <Text style={styles.header}>{tunnel.toUpperCase()}</Text>
          <Text>North lift: {status[tunnel].north ? '✅' : '❌'}</Text>
          <Text>South lift: {status[tunnel].south ? '✅' : '❌'}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' },
  text: { fontSize: 24, color: 'black' },
  header: { fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
  block: { margin: 20, alignItems: 'center' },
  loading: { marginTop: 100, textAlign: 'center', fontSize: 18 },
});
