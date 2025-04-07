import { Slot, useSegments } from "expo-router";
import { View } from "react-native";
import BottomNav from "../components/BottomNav";
// _layout.tsx or App.tsx (TOP of the file)
import 'react-native-get-random-values';

export default function Layout() {
  const segments = useSegments();

  // Check if the current route is under auth or is the splash screen
  const isAuth = segments[0] === "auth";
  const isSplashScreen = segments[0] === undefined;

  return (
    <View className="flex-1 bg-white">
      <Slot />
      {!isAuth && !isSplashScreen && <BottomNav />}
    </View>
  );
}
