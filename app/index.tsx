// app/index.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';

// Your firebase config here
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

initializeApp(firebaseConfig);
const db = getDatabase();

// Tunnel enum
enum Tunnel {
  Greenwich = 'greenwich',
  Woolwich = 'woolwich',
}

type LiftStatus = { north: boolean; south: boolean };
type TunnelStatus = Record<Tunnel, LiftStatus>;

const tunnelEntrances: { tunnel: Tunnel; side: 'north' | 'south'; lat: number; lon: number }[] = [
  { tunnel: Tunnel.Greenwich, side: 'north', lat: 51.4872, lon: -0.0046 },
  { tunnel: Tunnel.Greenwich, side: 'south', lat: 51.4810, lon: -0.0090 },
  { tunnel: Tunnel.Woolwich, side: 'north', lat: 51.4951, lon: 0.0608 },
  { tunnel: Tunnel.Woolwich, side: 'south', lat: 51.4921, lon: 0.0636 },
];


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
    if (!status) return;

    const checkProximity = async () => {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({});

      const dist = (a: { latitude: number; longitude: number }, b: { lat: number; lon: number }) =>
        Math.sqrt(Math.pow(a.latitude - b.lat, 2) + Math.pow(a.longitude - b.lon, 2));

      const notifiedTunnels = new Set<Tunnel>();

      tunnelEntrances.forEach(({ tunnel, lat, lon }) => {
        if (notifiedTunnels.has(tunnel)) return;
        if (dist(loc.coords, { lat, lon }) < 0.003 && status[tunnel]) {
          notifiedTunnels.add(tunnel);
          const s = status[tunnel];
          Notifications.scheduleNotificationAsync({
            content: {
              title: `Welcome to ${tunnel} foot tunnel`,
              body: `North lift: ${s.north ? 'Working' : 'Not working'}, South lift: ${s.south ? 'Working' : 'Not working'}`,
            },
            trigger: null,
          });
        }
      });
    };

    checkProximity();
  }, [status]);

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

