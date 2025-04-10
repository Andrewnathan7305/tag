import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../firebase/config';

export default function UserInfo() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [email, setEmail] = useState('');
  const [aadharNumber, setAadharNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const generateOTP = () => {
    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setOtp(otp);
    return otp;
  };

  const handleSubmit = async () => {
    if (!name || !age || !gender || !email || !aadharNumber) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (aadharNumber.length !== 12) {
      Alert.alert('Error', 'Aadhar number must be 12 digits');
      return;
    }

    try {
      // Generate OTP
      const userOtp = generateOTP();

      // Create user document in Firestore
      const userDoc = {
        phoneNumber: (global as any).phoneNumber,
        name,
        age,
        gender,
        email,
        aadharNumber,
        otp: userOtp, // Store the OTP
        verified: false,
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'users', (global as any).phoneNumber), userDoc);
      console.log('User document created with OTP:', userOtp);

      // Show success message with OTP
      Alert.alert(
        'Success',
        `Your account has been created successfully!\n\nYour OTP is: ${userOtp}\n\nPlease save this OTP as it will be required for ride confirmation.`,
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/main/yourride');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error creating user document:', error);
      Alert.alert('Error', 'Failed to create user account. Please try again.');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Complete Your Profile</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Full Name"
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={styles.input}
        placeholder="Age"
        value={age}
        onChangeText={setAge}
        keyboardType="numeric"
      />

      <View style={styles.genderContainer}>
        <TouchableOpacity
          style={[styles.genderButton, gender === 'Male' && styles.selectedGender]}
          onPress={() => setGender('Male')}
        >
          <Text style={[styles.genderText, gender === 'Male' && styles.selectedGenderText]}>Male</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.genderButton, gender === 'Female' && styles.selectedGender]}
          onPress={() => setGender('Female')}
        >
          <Text style={[styles.genderText, gender === 'Female' && styles.selectedGenderText]}>Female</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.genderButton, gender === 'Other' && styles.selectedGender]}
          onPress={() => setGender('Other')}
        >
          <Text style={[styles.genderText, gender === 'Other' && styles.selectedGenderText]}>Other</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Aadhar Number"
        value={aadharNumber}
        onChangeText={setAadharNumber}
        keyboardType="numeric"
        maxLength={12}
      />

      <TouchableOpacity 
        style={[styles.submitButton, loading && styles.disabledButton]} 
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Submit</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
  },
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  genderButton: {
    flex: 1,
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  selectedGender: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  genderText: {
    fontSize: 16,
    color: '#333',
  },
  selectedGenderText: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 