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

  const calculateRouteSimilarity = (riderRoute: Array<{latitude: number, longitude: number}>, 
                                  hostRoute: Array<{latitude: number, longitude: number}>) => {
    console.log('\n=== Route Comparison ===');
    console.log('Rider route points:', riderRoute.length);
    console.log('Host route points:', hostRoute.length);
    
    let totalDistance = 0;
    let pointsCompared = 0;
    let maxDistance = 0;
    let matchedPoints = 0;

    // For each point in the rider's route
    for (let i = 0; i < riderRoute.length; i++) {
      const riderPoint = riderRoute[i];
      let minDistance = Infinity;
      
      // Check against each segment of the host's route
      for (let j = 0; j < hostRoute.length - 1; j++) {
        const hostStart = hostRoute[j];
        const hostEnd = hostRoute[j + 1];
        
        // Calculate distance from rider point to host route segment
        const distance = distanceToLineSegment(
          riderPoint.latitude,
          riderPoint.longitude,
          hostStart.latitude,
          hostStart.longitude,
          hostEnd.latitude,
          hostEnd.longitude
        );
        
        minDistance = Math.min(minDistance, distance);
      }
      
      console.log(`Point ${i} min distance to host route:`, minDistance.toFixed(3), 'km');
      
      // If point is within 400m of any segment, consider it a match
      if (minDistance <= 0.4) { // 400m threshold
        totalDistance += minDistance;
        pointsCompared++;
        maxDistance = Math.max(maxDistance, minDistance);
        matchedPoints++;
      }
    }
    
    // Calculate percentage of matched points
    const matchPercentage = (matchedPoints / riderRoute.length) * 100;
    console.log('Matched points:', matchedPoints, 'out of', riderRoute.length);
    console.log('Match percentage:', matchPercentage.toFixed(2), '%');
    
    if (pointsCompared === 0) {
      console.log('❌ No points matched within 400m of host route');
      return 9999;
    }
    
    const avgDistance = totalDistance / pointsCompared;
    console.log('Average matched point distance:', avgDistance.toFixed(3), 'km');
    console.log('Maximum matched point distance:', maxDistance.toFixed(3), 'km');
    
    // If average distance is too high or match percentage is too low
    if (avgDistance > 0.4 || matchPercentage < 50) { // 400m threshold, 50% match required
      console.log('❌ Routes are too different');
      return 9999;
    }
    
    console.log('✅ Routes are similar enough');
    return avgDistance;
  };

  // New function to check if a point is along a route
  const isPointAlongRoute = (point: {latitude: number, longitude: number}, route: Array<{latitude: number, longitude: number}>) => {
    // Check each segment of the route
    for (let i = 0; i < route.length - 1; i++) {
      const start = route[i];
      const end = route[i + 1];
      
      // Calculate distance from point to line segment
      const distance = distanceToLineSegment(
        point.latitude,
        point.longitude,
        start.latitude,
        start.longitude,
        end.latitude,
        end.longitude
      );
      
      // If point is within 500m of any segment, consider it along the route
      if (distance <= 0.5) {
        return true;
      }
    }
    
    return false;
  };

  // Calculate distance from point to line segment
  const distanceToLineSegment = (lat: number, lon: number, lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    
    // Convert to radians
    const φ = lat * Math.PI / 180;
    const λ = lon * Math.PI / 180;
    const φ1 = lat1 * Math.PI / 180;
    const λ1 = lon1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const λ2 = lon2 * Math.PI / 180;
    
    // Calculate the cross-track distance
    const dλ = λ2 - λ1;
    const y = Math.sin(dλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
    const θ = Math.atan2(y, x);
    
    // Calculate the along-track distance
    const d = Math.acos(Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(dλ)) * R;
    
    // Calculate the cross-track distance
    const xtrack = Math.asin(Math.sin(d / R) * Math.sin(θ)) * R;
    
    return Math.abs(xtrack);
  };

  const fetchNearbyHosts = async (currentLocation: Location.LocationObject) => {
    try {
      console.log('\n=== Fetching Nearby Hosts ===');
      console.log('Current Location:', {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude
      });
      
      // Calculate 500m radius points for current location
      const radiusPoints = calculateRadiusPoints(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude,
        0.5 // 500m = 0.5km
      );
      console.log('500m radius points:', radiusPoints);
      
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
      const riderDestination = riderRide.endLocation;
      
      // Calculate 500m radius points for rider's destination
      const destinationRadiusPoints = calculateRadiusPoints(
        riderDestination.latitude,
        riderDestination.longitude,
        0.5 // 500m = 0.5km
      );
      
      console.log('\nRider Details:');
      console.log('Rider Phone:', riderRide.phoneNumber);
      console.log('Rider Destination:', riderDestination);
      console.log('Destination 500m radius points:', destinationRadiusPoints);
      console.log('Rider Route:', JSON.stringify(riderRoute, null, 2));
      console.log('Number of rider route points:', riderRoute.length);

      hostsSnapshot.forEach((doc) => {
        const hostData = doc.data() as Ride;
        // Filter for available hosts client-side
        if (hostData.status === 'available') {
          const hostRoute = hostData.routeCoordinates;
          const hostDestination = hostData.endLocation;
          
          console.log('\n=== Checking Host ===');
          console.log('Host ID:', doc.id);
          console.log('Host Phone:', hostData.phoneNumber);
          console.log('Host location:', {
            latitude: hostData.startLocation.latitude,
            longitude: hostData.startLocation.longitude
          });
          
          // Check if rider is within 500m of host's starting location
          const distanceToHost = calculateDistance(
            currentLocation.coords.latitude,
            currentLocation.coords.longitude,
            hostData.startLocation.latitude,
            hostData.startLocation.longitude
          );
          
          console.log('Distance to host start:', distanceToHost.toFixed(3), 'km');
          
          // Check if rider is within 500m of any segment of host's route
          let isNearRoute = false;
          let minRouteDistance = Infinity;
          
          for (let i = 0; i < hostRoute.length - 1; i++) {
            const hostStart = hostRoute[i];
            const hostEnd = hostRoute[i + 1];
            
            const distance = distanceToLineSegment(
              currentLocation.coords.latitude,
              currentLocation.coords.longitude,
              hostStart.latitude,
              hostStart.longitude,
              hostEnd.latitude,
              hostEnd.longitude
            );
            
            minRouteDistance = Math.min(minRouteDistance, distance);
            
            if (distance <= 0.5) { // 500m threshold
              isNearRoute = true;
              break;
            }
          }
          
          console.log('Minimum distance to host route:', minRouteDistance.toFixed(3), 'km');
          
          // Check if rider's destination is within 500m of host's destination
          const destinationDistance = calculateDistance(
            riderDestination.latitude,
            riderDestination.longitude,
            hostDestination.latitude,
            hostDestination.longitude
          );
          
          console.log('Distance to host destination:', destinationDistance.toFixed(3), 'km');
          
          // Check if rider's destination is within 500m of any segment of host's route
          let isDestinationNearRoute = false;
          let minDestinationRouteDistance = Infinity;
          
          for (let i = 0; i < hostRoute.length - 1; i++) {
            const hostStart = hostRoute[i];
            const hostEnd = hostRoute[i + 1];
            
            const distance = distanceToLineSegment(
              riderDestination.latitude,
              riderDestination.longitude,
              hostStart.latitude,
              hostStart.longitude,
              hostEnd.latitude,
              hostEnd.longitude
            );
            
            minDestinationRouteDistance = Math.min(minDestinationRouteDistance, distance);
            
            if (distance <= 0.5) { // 500m threshold
              isDestinationNearRoute = true;
              break;
            }
          }
          
          console.log('Minimum distance from destination to host route:', minDestinationRouteDistance.toFixed(3), 'km');
          
          // Check if start point criteria are met
          const startPointMatch = distanceToHost <= 0.5 || isNearRoute;
          console.log('Start point match:', startPointMatch);
          
          // Check if end point criteria are met
          const endPointMatch = destinationDistance <= 0.5 || isDestinationNearRoute;
          console.log('End point match:', endPointMatch);
          
          // If both start and end point criteria are met, consider it a match
          if (startPointMatch && endPointMatch) {
            console.log('✅ Host matches both start and end point criteria');
            nearbyHostsData.push(hostData);
          } else {
            console.log('❌ Host does not match criteria');
            if (!startPointMatch) {
              console.log('❌ Start point criteria not met');
            }
            if (!endPointMatch) {
              console.log('❌ End point criteria not met');
            }
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

