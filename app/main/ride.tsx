import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, TextInput, Alert } from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

// Move API key to a constant
const GOOGLE_MAPS_API_KEY = 'AIzaSyD0KBLJ0ralEzzvjM69YdBisF1dwOZx4nM';

interface Coordinate {
  latitude: number;
  longitude: number;
}

const RiderPage = () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);
  const [from, setFrom] = useState('Current Location');
  const [to, setTo] = useState('');
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);
  const [destinationLocation, setDestinationLocation] = useState<Coordinate | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access location was denied');
        setLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
      setLoading(false);
    })();
  }, []);

  const getRoute = async (destination: Coordinate) => {
    if (!location) return null;
    
    try {
      setRouteLoading(true);
      console.log('Fetching route from:', {
        lat: location.coords.latitude,
        lng: location.coords.longitude
      }, 'to:', destination);
      
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${location.coords.latitude},${location.coords.longitude}&destination=${destination.latitude},${destination.longitude}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const json = await response.json();
      
      console.log('Directions API response:', json);
      
      if (json.status !== 'OK') {
        console.error('Directions API error:', json.status, json.error_message);
        Alert.alert(
          'Route Error',
          'Unable to calculate route. Please try again later.',
          [{ text: 'OK' }]
        );
        return null;
      }
      
      if (json.routes && json.routes[0]) {
        const points = json.routes[0].overview_polyline.points;
        console.log('Encoded polyline points:', points);
        let coordinates = decodePolyline(points);
        
        // Optimize route points
        coordinates = optimizeRoutePoints(coordinates);
        
        console.log('Optimized coordinates:', coordinates);
        console.log('Number of coordinates:', coordinates.length);
        setRouteCoordinates(coordinates);
        return coordinates;
      } else {
        console.error('No routes found in response');
        Alert.alert(
          'Route Error',
          'No route found between locations.',
          [{ text: 'OK' }]
        );
        return null;
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      Alert.alert(
        'Error',
        'Failed to calculate route. Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
      return null;
    } finally {
      setRouteLoading(false);
    }
  };

  const decodePolyline = (encoded: string): Coordinate[] => {
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;
    const coordinates: Coordinate[] = [];

    while (index < len) {
      let shift = 0;
      let result = 0;
      let byte;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      coordinates.push({
        latitude: lat * 1e-5,
        longitude: lng * 1e-5,
      });
    }

    return coordinates;
  };

  const optimizeRoutePoints = (coordinates: Coordinate[]): Coordinate[] => {
    if (coordinates.length <= 2) return coordinates;
    
    const optimized: Coordinate[] = [coordinates[0]];
    const MIN_DISTANCE = 0.0001; // Approximately 10 meters
    
    for (let i = 1; i < coordinates.length - 1; i++) {
      const prev = coordinates[i - 1];
      const current = coordinates[i];
      const next = coordinates[i + 1];
      
      // Calculate distance between current point and previous point
      const distance = calculateDistance(
        prev.latitude,
        prev.longitude,
        current.latitude,
        current.longitude
      );
      
      // Only add point if it's significantly different from previous point
      if (distance > MIN_DISTANCE) {
        optimized.push(current);
      }
    }
    
    // Always add the last point
    optimized.push(coordinates[coordinates.length - 1]);
    
    return optimized;
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

  const handleSearch = async () => {
    console.log('Searching for ride...');
    console.log('From:', from);
    console.log('To:', to);
    if (destinationLocation) {
      const coordinates = await getRoute(destinationLocation);
      if (coordinates) {
        await saveRideToFirebase(coordinates);
      }
    }
  };

  const saveRideToFirebase = async (coordinates: Coordinate[]) => {
    if (!location || !destinationLocation) {
      console.error('Missing location data');
      Alert.alert(
        'Error',
        'Location data is missing. Please try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      console.log('Starting Firebase save operation...');
      console.log('Phone number:', (global as any).phoneNumber);
      console.log('Current route coordinates:', coordinates);
      
      if (!(global as any).phoneNumber) {
        throw new Error('Phone number is not available');
      }

      // Get the current ride count from Firebase
      const ridesCollection = collection(db, 'rides');
      const ridesSnapshot = await getDocs(ridesCollection);
      const rideCount = ridesSnapshot.size;
      
      // Use incrementing number for rideId
      const rideId = `ride_${rideCount + 1}`;
      console.log('Using rideId:', rideId);
      
      const rideData = {
        rideId: rideId,
        startLocation: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          address: from,
          timestamp: new Date().toISOString()
        },
        endLocation: {
          latitude: destinationLocation.latitude,
          longitude: destinationLocation.longitude,
          address: to,
          timestamp: new Date().toISOString()
        },
        routeCoordinates: coordinates,
        phoneNumber: (global as any).phoneNumber,
        type: 'rider',
        status: 'active',
        createdAt: serverTimestamp()
      };

      console.log('Saving ride data:', JSON.stringify(rideData, null, 2));

      // Save to the main rides collection with rideId as document ID
      const docRef = await addDoc(ridesCollection, rideData);
      console.log('Saved to rides collection with ID:', docRef.id);

      // Save to user's rides collection with the same rideId
      const userRidesCollection = collection(db, `users/${(global as any).phoneNumber}/rides`);
      const userDocRef = await addDoc(userRidesCollection, {
        ...rideData,
        mainRideId: docRef.id  // Store reference to main ride document
      });
      console.log('Saved to user rides collection with ID:', userDocRef.id);

      Alert.alert(
        'Success',
        'Ride saved successfully!',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Detailed Firebase error:', error);
      Alert.alert(
        'Error',
        `Failed to save ride data: ${(error as Error).message}`,
        [{ text: 'OK' }]
      );
    }
  };

  if (loading || !location) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Card above the map */}
      <View style={styles.cardContainer}>
        <View style={styles.inputContainer}>
          <View style={styles.locationIcon}>
            <Ionicons name="location" size={20} color="#2563eb" />
          </View>
          <TextInput
            placeholder="Current Location"
            value={from}
            style={styles.input}
            editable={false}
          />
        </View>

        <View style={styles.inputContainer}>
          <View style={styles.locationIcon}>
            <Ionicons name="location-outline" size={20} color="#2563eb" />
          </View>
          <GooglePlacesAutocomplete
            placeholder="Where to?"
            fetchDetails={true}
            onPress={(data, details = null) => {
              const destination = data.description;
              setTo(destination);
              if (details?.geometry?.location) {
                setDestinationLocation({
                  latitude: details.geometry.location.lat,
                  longitude: details.geometry.location.lng,
                });
              }
              console.log('Destination:', destination);
            }}
            query={{
              key: GOOGLE_MAPS_API_KEY,
              language: 'en',
            }}
            styles={{
              textInput: styles.input,
              listView: { 
                backgroundColor: 'white', 
                borderRadius: 8,
                marginTop: 10,
                elevation: 3,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
              },
            }}
          />
        </View>

        <TouchableOpacity 
          onPress={handleSearch} 
          style={[styles.button, routeLoading && styles.buttonDisabled]}
          disabled={routeLoading}
        >
          {routeLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Search Rides</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Map below the card */}
      <MapView
        style={styles.map}
        showsUserLocation={true}
        initialRegion={{
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        <Marker
          coordinate={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          }}
          title="You"
          description="Your current location"
        />
        {destinationLocation && (
          <Marker
            coordinate={destinationLocation}
            title="Destination"
            pinColor="red"
          />
        )}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={4}
            strokeColor="#2563eb"
          />
        )}
      </MapView>
    </View>
  );
};

export default RiderPage;

const styles = StyleSheet.create({
  cardContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 20,
    right: 20,
    zIndex: 10,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  locationIcon: {
    padding: 12,
  },
  input: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  map: {
    flex: 1,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
