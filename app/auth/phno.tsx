import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import Logo from '../../assets/logo.svg';
import { useRouter } from 'expo-router';

export default function PhoneNumber() {
  const [phone, setPhone] = useState('');
  const router = useRouter();

  const isValid = phone.length === 10;

  return (
    <View className="flex-1 bg-[#007AFF] px-6 pt-16">
      <View className="items-center mb-8">
        <Logo width={100} height={100} />
      </View>

      <Text className="text-white text-2xl font-bold text-center mb-8 leading-relaxed">
        Bike-pooling Made Easy{'\n'}
        <Text className="text-lg font-normal">Fast, Cheap, Green, and Rewarding!</Text>
      </Text>

      <View className="bg-white rounded-t-3xl pt-6 pb-10 px-4 -mx-6 flex-1">
        <Text className="text-lg font-semibold mb-3">Enter your phone number</Text>

        <View className="flex-row items-center border border-gray-300 rounded-xl px-4 py-3 mb-6">
          <Text className="text-base mr-2 text-gray-600">+91</Text>
          <TextInput
            className="flex-1 text-base text-black"
            keyboardType="numeric"
            maxLength={10}
            placeholder="Phone number"
            value={phone}
            onChangeText={setPhone}
          />
        </View>

        <TouchableOpacity
          className={`py-4 rounded-xl ${isValid ? 'bg-[#007AFF]' : 'bg-white border border-gray-300'}`}
          onPress={() => {
            if (isValid) router.replace('/auth/otp'); // replace with actual next screen
          }}
        >
          <Text className={`text-center font-bold ${isValid ? 'text-white' : 'text-black'}`}>
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
