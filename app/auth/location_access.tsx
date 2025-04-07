import { View, Text, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useState } from 'react';
import { router } from 'expo-router';
import Logo from '../../assets/logo.svg'; // Adjust if needed
import LocationSVG from '../../assets/arrow.svg';

export default function LocationScreen() {
  const [loading, setLoading] = useState(false);

  const handleLocationAccess = async () => {
    try {
      setLoading(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to continue.');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      console.log('User location:', location);

      // Save to Firebase Firestore
      await addDoc(collection(db, 'locations'), {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date().toISOString(),
      });

      router.replace('/auth/phno');
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', 'Something went wrong while fetching/saving location.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-[#007AFF] justify-center items-center px-6">
      <Logo width={100} height={100} />

      <View className="bg-white mt-8 rounded-t-2xl w-full p-6 flex items-center">
        <Text className="text-xl font-bold mb-4">Allow Location Access</Text>
        <LocationSVG width={96} height={96} className="mb-4" />
        <Text className="text-center mb-6 text-gray-600">
          By allowing location access you help us to provide precise pick-up/drop-off at your location
        </Text>

        <TouchableOpacity
          onPress={handleLocationAccess}
          className="bg-[#007AFF] px-6 py-3 rounded-full"
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold">Allow Access</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
