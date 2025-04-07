import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { useRouter } from 'expo-router';
import Logo from '../assets/logo.svg';
import '../global.css'

export default function Index() {
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(-200)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      router.replace('../auth/location_access');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View className="flex-1 justify-center items-center bg-[#007AFF]">
      <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
        <Logo width={120} height={120} />
      </Animated.View>
    </View>
  );
}
