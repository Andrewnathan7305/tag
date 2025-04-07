import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'react-native';

const OtpScreen = () => {
  const router = useRouter();
  const { phone } = useLocalSearchParams();
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const inputsRef = useRef<Array<TextInput | null>>([]);

  const handleChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleContinue = () => {
    const enteredOtp = otp.join('');
    if (enteredOtp === '000000') {
      // Store phone number in global scope
      (global as any).phoneNumber = phone;
      router.replace('/main/ride');
    } else {
      alert('Invalid OTP. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-[#007AFF] items-center justify-start pt-24 px-4"
    >
      {/* Logo */}
      <Image source={require('../../assets/logo.svg')} className="w-24 h-24 mb-4" resizeMode="contain" />

      {/* Title */}
      <Text className="text-white text-2xl font-bold text-center mb-2">
        Bike-pooling Made Easy
      </Text>
      <Text className="text-white text-base text-center mb-6">
        Fast, Cheap, Green, and Rewarding!
      </Text>

      {/* Card */}
      <View className="bg-white w-full rounded-t-2xl px-6 py-8 flex items-center justify-center flex-grow">
        <Text className="text-xl font-semibold mb-6">Enter OTP</Text>

        {/* OTP Boxes */}
        <View className="flex-row justify-between w-full mb-8">
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputsRef.current[index] = ref)}
              className="border border-gray-400 w-12 h-12 rounded-md text-center text-lg"
              keyboardType="numeric"
              maxLength={1}
              value={digit}
              onChangeText={(text) => handleChange(text, index)}
            />
          ))}
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          onPress={handleContinue}
          className={`w-full py-3 rounded-xl ${
            otp.every((val) => val !== '') ? 'bg-[#007AFF]' : 'bg-gray-300'
          }`}
          disabled={!otp.every((val) => val !== '')}
        >
          <Text className="text-white text-center font-semibold text-lg">Continue</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

export default OtpScreen;
