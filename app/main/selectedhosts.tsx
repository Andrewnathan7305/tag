import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Ionicons } from '@expo/vector-icons';

interface Match {
  id: string;
  riderPhoneNumber: string;
  hostPhoneNumber: string;
  rideId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: any;
  riderLocation: {
    latitude: number;
    longitude: number;
    address: string;
    timestamp: string;
  };
  hostLocation: {
    latitude: number;
    longitude: number;
    address: string;
    timestamp: string;
  };
}

const SelectedHostsPage = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const matchesQuery = query(
        collection(db, 'ride_matches'),
        where('riderPhoneNumber', '==', (global as any).phoneNumber)
      );

      // Set up real-time listener
      const unsubscribe = onSnapshot(matchesQuery, (snapshot) => {
        const matchesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Match[];
        setMatches(matchesData);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error fetching matches:', error);
      Alert.alert('Error', 'Failed to fetch selected hosts. Please try again.');
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#f59e0b'; // orange
      case 'accepted':
        return '#10b981'; // green
      case 'rejected':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Selected Hosts</Text>
      {loading ? (
        <Text>Loading...</Text>
      ) : matches.length === 0 ? (
        <Text style={styles.noMatches}>No hosts selected yet</Text>
      ) : (
        matches.map((match) => (
          <View key={match.id} style={styles.matchCard}>
            <View style={styles.matchHeader}>
              <Text style={styles.hostPhone}>Host: {match.hostPhoneNumber}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(match.status) }]}>
                <Text style={styles.statusText}>{match.status}</Text>
              </View>
            </View>

            <View style={styles.locationContainer}>
              <View style={styles.locationRow}>
                <Ionicons name="location" size={20} color="#2563eb" />
                <Text style={styles.locationText}>Your Location: {match.riderLocation.address}</Text>
              </View>
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={20} color="#2563eb" />
                <Text style={styles.locationText}>Host Location: {match.hostLocation.address}</Text>
              </View>
            </View>

            <View style={styles.timeContainer}>
              <Ionicons name="time" size={20} color="#2563eb" />
              <Text style={styles.timeText}>
                Selected: {new Date(match.createdAt?.toDate()).toLocaleString()}
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f3f4f6',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#1f2937',
  },
  noMatches: {
    textAlign: 'center',
    fontSize: 16,
    color: '#6b7280',
    marginTop: 20,
  },
  matchCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  hostPhone: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
  },
  locationContainer: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#374151',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6b7280',
  },
});

export default SelectedHostsPage; 