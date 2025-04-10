// app/ride.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, limit, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

interface Ride {
  id: string;
  rideId: string;
  startLocation: {
    latitude: number;
    longitude: number;
    address: string;
    timestamp: string;
  };
  endLocation: {
    latitude: number;
    longitude: number;
    address: string;
    timestamp: string;
  };
  routeCoordinates: Array<{ latitude: number; longitude: number }>;
  phoneNumber: string;
  type: 'ride' | 'host';
  status: string;
  availableSeats?: number;
  price?: number;
  createdAt: any;
  mainRideId: string;
}

const YourRidePage = () => {
  const [nearbyHosts, setNearbyHosts] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    fetchLocationAndNearbyHosts();
  }, []);

  const fetchLocationAndNearbyHosts = async () => {
    try {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to find nearby hosts.');
        return;
      }

      // Get current location
      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);

      // Fetch nearby host rides
      await fetchNearbyHosts(currentLocation);
    } catch (error) {
      console.error('Error fetching location:', error);
      Alert.alert('Error', 'Failed to get location. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in km
    return distance;
  };

  const deg2rad = (deg: number) => {
    return deg * (Math.PI/180);
  };

  // New function to calculate radius points
  const calculateRadiusPoints = (centerLat: number, centerLon: number, radiusKm: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = (radiusKm / R) * (180 / Math.PI);
    const dLon = dLat / Math.cos(centerLat * Math.PI / 180);
    
    return {
      north: centerLat + dLat,
      south: centerLat - dLat,
      east: centerLon + dLon,
      west: centerLon - dLon
    };
  };

  // Function to normalize a path to have a specific number of points
  function normalizePath(path: { latitude: number; longitude: number }[], numPoints: number) {
    if (path.length <= numPoints) {
      return path;
    }
    
    const result = [];
    const step = (path.length - 1) / (numPoints - 1);
    
    for (let i = 0; i < numPoints; i++) {
      const index = i * step;
      const lowIndex = Math.floor(index);
      const highIndex = Math.min(lowIndex + 1, path.length - 1);
      const fraction = index - lowIndex;
      
      const lowPoint = path[lowIndex];
      const highPoint = path[highIndex];
      
      result.push({
        latitude: lowPoint.latitude + (highPoint.latitude - lowPoint.latitude) * fraction,
        longitude: lowPoint.longitude + (highPoint.longitude - lowPoint.longitude) * fraction
      });
    }
    
    return result;
  }

  // Function to calculate the direction of a path
  function calculatePathDirection(path: { latitude: number; longitude: number }[]) {
    if (path.length < 2) {
      return { latitude: 0, longitude: 0 };
    }
    
    const start = path[0];
    const end = path[path.length - 1];
    
    return {
      latitude: end.latitude - start.latitude,
      longitude: end.longitude - start.longitude
    };
  }

  // Function to calculate similarity between two directions
  function calculateDirectionSimilarity(dir1: { latitude: number; longitude: number }, dir2: { latitude: number; longitude: number }) {
    // Calculate dot product
    const dotProduct = dir1.latitude * dir2.latitude + dir1.longitude * dir2.longitude;
    
    // Calculate magnitudes
    const mag1 = Math.sqrt(dir1.latitude * dir1.latitude + dir1.longitude * dir1.longitude);
    const mag2 = Math.sqrt(dir2.latitude * dir2.latitude + dir2.longitude * dir2.longitude);
    
    if (mag1 === 0 || mag2 === 0) {
      return 0;
    }
    
    // Calculate cosine of angle
    const cosAngle = dotProduct / (mag1 * mag2);
    
    // Convert to similarity (0-1 range, where 1 means same direction)
    return (cosAngle + 1) / 2;
  }

  // Function to calculate path similarity percentage
  function calculatePathSimilarity(riderPath: { latitude: number; longitude: number }[], hostPath: { latitude: number; longitude: number }[]) {
    console.log('\n=== Calculating Path Similarity ===');
    console.log('Rider path points:', riderPath.length);
    console.log('Host path points:', hostPath.length);
    
    // 1. Normalize paths to have similar number of points
    const numPoints = 50; // Use 50 points for comparison
    const normalizedRiderPath = normalizePath(riderPath, numPoints);
    const normalizedHostPath = normalizePath(hostPath, numPoints);
    
    console.log('Normalized to', numPoints, 'points each');
    
    // 2. Calculate point-to-point distances
    let totalDistance = 0;
    let matchedPoints = 0;
    let maxDistance = 0;
    
    for (let i = 0; i < normalizedRiderPath.length; i++) {
      const riderPoint = normalizedRiderPath[i];
      let minDistance = Infinity;
      
      // Find closest point in host path
      for (let j = 0; j < normalizedHostPath.length; j++) {
        const hostPoint = normalizedHostPath[j];
        const distance = calculateDistance(
          riderPoint.latitude, riderPoint.longitude,
          hostPoint.latitude, hostPoint.longitude
        );
        
        minDistance = Math.min(minDistance, distance);
      }
      
      totalDistance += minDistance;
      maxDistance = Math.max(maxDistance, minDistance);
      
      if (minDistance <= 0.5) { // 500m threshold
        matchedPoints++;
      }
      
      if (i % 10 === 0) {
        console.log(`Point ${i}: min distance = ${minDistance.toFixed(3)} km`);
      }
    }
    
    // 3. Calculate direction similarity
    const riderDirection = calculatePathDirection(normalizedRiderPath);
    const hostDirection = calculatePathDirection(normalizedHostPath);
    const directionSimilarity = calculateDirectionSimilarity(riderDirection, hostDirection);
    
    console.log('Direction similarity:', (directionSimilarity * 100).toFixed(2) + '%');
    
    // 4. Calculate overall similarity percentage
    const pointMatchPercentage = (matchedPoints / normalizedRiderPath.length) * 100;
    const avgDistance = totalDistance / normalizedRiderPath.length;
    const distanceScore = Math.max(0, 100 - (avgDistance * 20)); // Scale factor
    
    console.log('Point match percentage:', pointMatchPercentage.toFixed(2) + '%');
    console.log('Average distance:', avgDistance.toFixed(3), 'km');
    console.log('Distance score:', distanceScore.toFixed(2) + '%');
    console.log('Max distance:', maxDistance.toFixed(3), 'km');
    
    // 5. Combine metrics with weights
    const similarityPercentage = 
      (pointMatchPercentage * 0.6) + 
      (distanceScore * 0.2) + 
      (directionSimilarity * 100 * 0.2);
      
    console.log('Overall similarity percentage:', similarityPercentage.toFixed(2) + '%');
    
    return similarityPercentage;
  }

  const fetchNearbyHosts = async (currentLocation: Location.LocationObject) => {
    try {
      console.log('\n=== Fetching Nearby Hosts ===');
      console.log('Current Location:', {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude
      });
      
      // Simplified query to avoid needing composite index
      const hostsQuery = query(
        collection(db, 'rides'),
        where('type', '==', 'host')
      );
      const hostsSnapshot = await getDocs(hostsQuery);
      console.log('Total hosts found:', hostsSnapshot.size);
      
      const nearbyHostsData: Ride[] = [];

      // First check main rides collection for rider's ride
      const mainRiderQuery = query(
        collection(db, 'rides'),
        where('type', '==', 'rider')
      );
      const mainRiderSnapshot = await getDocs(mainRiderQuery);

      let riderRide: Ride | null = null;

      // Find the latest ride for the current user
      const userRides = mainRiderSnapshot.docs
        .map(doc => doc.data() as Ride)
        .filter(ride => ride.phoneNumber === (global as any).phoneNumber)
        .sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());

      if (userRides.length > 0) {
        riderRide = userRides[0];
        console.log('Found rider ride in main collection');
      } else {
        // If not found in main collection, check user's collection
        const userRiderQuery = query(
          collection(db, `users/${(global as any).phoneNumber}/rides`),
          where('type', '==', 'rider')
        );
        const userRiderSnapshot = await getDocs(userRiderQuery);
        
        if (!userRiderSnapshot.empty) {
          // Sort by createdAt desc and get the latest ride
          const sortedRides = userRiderSnapshot.docs
            .map(doc => doc.data() as Ride)
            .sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
          const userRide = sortedRides[0];
          // Get the main ride details
          const mainRideDoc = await getDoc(doc(db, 'rides', userRide.mainRideId));
          if (mainRideDoc.exists()) {
            riderRide = mainRideDoc.data() as Ride;
            console.log('Found rider ride in user collection');
          }
        }
      }
      
      if (!riderRide) {
        console.log('No rider ride found, showing all hosts');
        // If no ride request exists, show all available hosts
        hostsSnapshot.forEach((doc) => {
          const hostData = doc.data() as Ride;
          // Filter for available hosts client-side
          if (hostData.status === 'available') {
            // Check if host is within 500m of current location
            const distanceToHost = calculateDistance(
              currentLocation.coords.latitude,
              currentLocation.coords.longitude,
              hostData.startLocation.latitude,
              hostData.startLocation.longitude
            );
            
            console.log('\n=== Checking Host Proximity ===');
            console.log('Host ID:', doc.id);
            console.log('Distance to host:', distanceToHost.toFixed(3), 'km');
            console.log('Host location:', {
              latitude: hostData.startLocation.latitude,
              longitude: hostData.startLocation.longitude
            });
            
            if (distanceToHost <= 0.5) { // 500m radius
              console.log('✅ Host is within 500m radius');
              nearbyHostsData.push(hostData);
            } else {
              console.log('❌ Host is too far from current location');
            }
          }
        });
        setNearbyHosts(nearbyHostsData);
        return;
      }

      const riderRoute = riderRide.routeCoordinates;
      
      console.log('\nRider Details:');
      console.log('Rider Phone:', riderRide.phoneNumber);
      console.log('Rider Route:', JSON.stringify(riderRoute, null, 2));
      console.log('Number of rider route points:', riderRoute.length);

      // Set similarity threshold (75%)
      const SIMILARITY_THRESHOLD = 75;

      hostsSnapshot.forEach((doc) => {
        const hostData = doc.data() as Ride;
        // Filter for available hosts client-side
        if (hostData.status === 'available') {
          const hostRoute = hostData.routeCoordinates;
          
          console.log('\n=== Checking Host ===');
          console.log('Host ID:', doc.id);
          console.log('Host Phone:', hostData.phoneNumber);
          console.log('Host location:', {
            latitude: hostData.startLocation.latitude,
            longitude: hostData.startLocation.longitude
          });
          console.log('Number of host route points:', hostRoute.length);
          
          // Calculate path similarity
          const similarityPercentage = calculatePathSimilarity(riderRoute, hostRoute);
          
          // Check if paths are similar enough
          if (similarityPercentage >= SIMILARITY_THRESHOLD) {
            console.log(`✅ Host path is ${similarityPercentage.toFixed(2)}% similar to rider path (threshold: ${SIMILARITY_THRESHOLD}%)`);
            nearbyHostsData.push(hostData);
          } else {
            console.log(`❌ Host path is only ${similarityPercentage.toFixed(2)}% similar to rider path (threshold: ${SIMILARITY_THRESHOLD}%)`);
          }
        }
      });

      console.log('\n=== Final Results ===');
      console.log('Number of matching hosts:', nearbyHostsData.length);
      setNearbyHosts(nearbyHostsData);
    } catch (error) {
      console.error('Error fetching nearby hosts:', error);
      Alert.alert('Error', 'Failed to fetch nearby hosts. Please try again.');
    }
  };

  const handleSelectHost = async (hostRide: Ride) => {
    try {
      if (!(global as any).phoneNumber) {
        throw new Error('Phone number is not available');
      }

      // Create a new ride for the rider
      const rideData = {
        rideId: hostRide.rideId, // Use the same rideId as the host
        startLocation: {
          latitude: location?.coords.latitude,
          longitude: location?.coords.longitude,
          address: "Current Location",
          timestamp: new Date().toISOString()
        },
        endLocation: hostRide.endLocation,
        routeCoordinates: hostRide.routeCoordinates,
        phoneNumber: (global as any).phoneNumber,
        type: 'ride',
        status: 'matched',
        createdAt: serverTimestamp()
      };

      // Save to main rides collection
      await addDoc(collection(db, 'rides'), rideData);

      // Save to user's rides collection
      await addDoc(collection(db, `users/${(global as any).phoneNumber}/rides`), rideData);

      Alert.alert(
        'Success',
        'Ride matched successfully! You can view it in Your Rides.',
        [{ text: 'OK' }]
      );

      // Refresh nearby hosts
      await fetchNearbyHosts(location!);
    } catch (error) {
      console.error('Error selecting host:', error);
      Alert.alert('Error', 'Failed to match with host. Please try again.');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Nearby Hosts</Text>
      {loading ? (
        <Text>Loading...</Text>
      ) : nearbyHosts.length === 0 ? (
        <Text style={styles.noRides}>No nearby hosts found</Text>
      ) : (
        nearbyHosts.map((host) => (
          <View key={host.rideId} style={styles.rideCard}>
            <View style={styles.rideHeader}>
              <Text style={styles.rideType}>Host</Text>
              <Text style={styles.rideStatus}>{host.status}</Text>
            </View>

            <View style={styles.locationContainer}>
              <View style={styles.locationRow}>
                <Ionicons name="location" size={20} color="#2563eb" />
                <Text style={styles.locationText}>From: {host.startLocation.address}</Text>
              </View>
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={20} color="#2563eb" />
                <Text style={styles.locationText}>To: {host.endLocation.address}</Text>
              </View>
            </View>

            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <Ionicons name="people" size={20} color="#2563eb" />
                <Text style={styles.detailText}>Available Seats: {host.availableSeats}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="cash" size={20} color="#2563eb" />
                <Text style={styles.detailText}>Price: ${host.price}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => handleSelectHost(host)}
            >
              <Text style={styles.selectButtonText}>Select This Host</Text>
            </TouchableOpacity>
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
  noRides: {
    textAlign: 'center',
    fontSize: 16,
    color: '#6b7280',
    marginTop: 20,
  },
  rideCard: {
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
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  rideType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
  rideStatus: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
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
  detailsContainer: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#374151',
  },
  selectButton: {
    backgroundColor: '#2563eb',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default YourRidePage;

