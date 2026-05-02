import { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as SecureStore from "expo-secure-store";

import LoginScreen             from "./src/screens/LoginScreen";
import RegisterScreen          from "./src/screens/RegisterScreen";
import ClassPickerScreen       from "./src/screens/ClassPickerScreen";
import HomeScreen              from "./src/screens/HomeScreen";
import AnalyticsScreen         from "./src/screens/AnalyticsScreen";
import ReportScreen            from "./src/screens/ReportScreen";
import LecturerDashboardScreen from "./src/screens/LecturerDashboardScreen";
import ProfileScreen           from "./src/screens/ProfileScreen";
import ManageClassesScreen     from "./src/screens/ManageClassesScreen"; // match your filename exactly

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerStyle:      { backgroundColor: "#4361ee" },
  headerTintColor:  "#fff",
  headerTitleStyle: { fontWeight: "700" },
};

// Pass setToken down so login/register can trigger stack switch
function AuthStack({ setToken }) {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Login"    options={{ headerShown: false }}>
        {(props) => <LoginScreen {...props} setToken={setToken} />}
      </Stack.Screen>
      <Stack.Screen name="Register" options={{ headerShown: false }}>
        {(props) => <RegisterScreen {...props} setToken={setToken} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function AppStack({ setToken, userRole }) {
  return (
    <Stack.Navigator
      initialRouteName={userRole === "lecturer" ? "LecturerDashboard" : "ClassPicker"}
      screenOptions={screenOptions}
    >
      <Stack.Screen name="LecturerDashboard" options={{ title: "Dashboard", headerShown: false }}>
        {(props) => <LecturerDashboardScreen {...props} setToken={setToken} />}
      </Stack.Screen>
      <Stack.Screen name="ClassPicker" component={ClassPickerScreen}
        options={{ title: "Select Class", headerBackVisible: false }} />
      <Stack.Screen name="Home" options={{ title: "Mark Attendance", headerBackVisible: false }}>
        {(props) => <HomeScreen {...props} setToken={setToken} />}
      </Stack.Screen>
      <Stack.Screen name="Analytics" component={AnalyticsScreen}
        options={{ title: "My Attendance" }} />
      <Stack.Screen name="Report" component={ReportScreen}
        options={{ title: "Class Report" }} />
      <Stack.Screen name="ManageClasses" component={ManageClassesScreen}
        options={{ title: "Manage Classes" }} />
      <Stack.Screen name="Profile" options={{ title: "My Profile" }}>
        {(props) => <ProfileScreen {...props} setToken={setToken} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

export default function App() {
  const [token, setToken]     = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [ready, setReady]     = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      const t = await SecureStore.getItemAsync("token");
      const raw = await SecureStore.getItemAsync("user");
      if (t && raw) {
        const user = JSON.parse(raw);
        setToken(t);
        setUserRole(user.role);
      }
      setReady(true);
    };
    bootstrap();
  }, []);

  // Called by LoginScreen/RegisterScreen after successful auth
  const handleSetToken = async (token, user) => {
    await SecureStore.setItemAsync("token", token);
    await SecureStore.setItemAsync("user", JSON.stringify(user));
    setUserRole(user.role);
    setToken(token);  // this triggers re-render → AppStack shown automatically
  };

  if (!ready) return null;

  return (
    <NavigationContainer>
      {token
        ? <AppStack setToken={setToken} userRole={userRole} />
        : <AuthStack setToken={handleSetToken} />}
    </NavigationContainer>
  );
}