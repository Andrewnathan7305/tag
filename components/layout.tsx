import React from "react";
import { View } from "react-native";
import BottomNav from "./BottomNav";

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <View className="flex-1 justify-between bg-blue-50">
      <View className="flex-1 p-4">
        {children}
      </View>
      <BottomNav />
    </View>
  );
};

export default Layout;
