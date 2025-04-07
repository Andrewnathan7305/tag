import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter, usePathname } from "expo-router";
import type { SvgProps } from "react-native-svg";

// Import your SVG icons
import RideIcon from "../assets/ThumbsUpVector.svg";
import HostIcon from "../assets/host.svg";
import YourRidesIcon from "../assets/yourride.svg";
import InboxIcon from "../assets/inbox.svg";
import ProfileIcon from "../assets/profile.svg";

// Explicit route types
type MainTabPath = "/main/ride" | "/main/host" | "/main/yourride" | "/main/inbox" | "/main/profile";

const tabs: {
  label: string;
  icon: React.FC<SvgProps>;
  path: MainTabPath;
}[] = [
  { label: "Ride", icon: RideIcon, path: "/main/ride" },
  { label: "Host", icon: HostIcon, path: "/main/host" },
  { label: "Your Rides", icon: YourRidesIcon, path: "/main/yourride" },
  { label: "Inbox", icon: InboxIcon, path: "/main/inbox" },
  { label: "Profile", icon: ProfileIcon, path: "/main/profile" },
];

const BottomNav = () => {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View className="flex-row justify-between items-center bg-white border-t border-gray-200 py-3 px-4">
      {tabs.map((tab, index) => {
        const Icon = tab.icon;
        const isActive = pathname === tab.path;

        return (
          <TouchableOpacity
            key={index}
            className="items-center flex-1"
            onPress={() => router.replace(tab.path)}
          >
            <Icon width={24} height={24} fill="#000000" />
            <Text
              className={`text-xs mt-1 ${isActive ? "text-blue-600 font-semibold" : "text-blue-500"}`} // Blue for active, gray for inactive
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default BottomNav;
