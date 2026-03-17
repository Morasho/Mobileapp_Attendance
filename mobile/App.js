import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import AnalyticsScreen from "./src/screens/AnalyticsScreen";
import ClassPickerScreen from "./src/screens/ClassPickerScreen";
import HomeScreen from "./src/screens/HomeScreen";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import ReportScreen from "./src/screens/ReportScreen";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerStyle:      { backgroundColor: "#4361ee" },
          headerTintColor:  "#fff",
          headerTitleStyle: { fontWeight: "700" },
        }}
      >
        <Stack.Screen name="Login"       component={LoginScreen}       options={{ headerShown: false }} />
        <Stack.Screen name="Register"    component={RegisterScreen}    options={{ headerShown: false }} />
        <Stack.Screen name="ClassPicker" component={ClassPickerScreen} options={{ title: "Select Class", headerBackVisible: false }} />
        <Stack.Screen name="Home"        component={HomeScreen}        options={{ title: "Mark Attendance", headerBackVisible: false }} />
        <Stack.Screen name="Analytics"   component={AnalyticsScreen}   options={{ title: "My Attendance" }} />
        <Stack.Screen name="Report"      component={ReportScreen}      options={{ title: "Class Report" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}