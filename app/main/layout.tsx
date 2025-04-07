import { Slot } from "expo-router";
import { View } from "react-native";
import BottomNav from "../../components/BottomNav";

export default function MainLayout() {
  return (
    <View className="flex-1 bg-white">
      <Slot />
      <BottomNav />
    </View>
  );
}
