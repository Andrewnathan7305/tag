import React, { useEffect, useState } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

const RiderPage = () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

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

  const handleSearch = () => {
    console.log('Leaving from:', from);
    console.log('Going to:', to);
    // TODO: Save to Firebase
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
        <TextInput
          placeholder="Leaving from"
          value={from}
          onChangeText={setFrom}
          style={styles.input}
        />

        <GooglePlacesAutocomplete
          placeholder="Going to"
          fetchDetails={true}
          onPress={(data, details = null) => {
            const destination = data.description;
            setTo(destination);
            console.log('Destination:', destination);
          }}
          query={{
            key: 'AIzaSyD0KBLJ0ralEzzvjM69YdBisF1dwOZx4nM',
            language: 'en',
          }}
          styles={{
            textInput: styles.input,
            listView: { backgroundColor: 'white', borderRadius: 8 },
          }}
        />

        <TouchableOpacity onPress={handleSearch} style={styles.button}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>Search</Text>
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
      </MapView>
    </View>
  );
};

export default RiderPage;

const styles = StyleSheet.create({
  cardContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#2563eb', // Tailwind blue-600
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  map: {
    flex: 1,
  },
});
