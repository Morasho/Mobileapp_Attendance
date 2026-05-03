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
import SessionManagerScreen    from "./src/screens/SessionManagerScreen";
import ManageClassesScreen     from "./src/screens/ManageClassesScreen";
import AdminDashboardScreen    from "./src/screens/AdminDashboardScreen";
import AdminCoursesScreen      from "./src/screens/AdminCoursesScreen";
import AdminUnitsScreen        from "./src/screens/AdminUnitsScreen";
import AdminLecturersScreen    from "./src/screens/AdminLecturersScreen";
import AdminStudentsScreen     from "./src/screens/AdminStudentsScreen";
import AdminPeriodsScreen from "./src/screens/AdminPeriodsScreen";
import AdminSemesterReportScreen from "./src/screens/AdminSemesterReportScreen";

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerStyle:      { backgroundColor: "#4361ee" },
  headerTintColor:  "#fff",
  headerTitleStyle: { fontWeight: "700" },
};

function AuthStack({ setToken }) {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Login" options={{ headerShown: false }}>
        {(props) => <LoginScreen {...props} setToken={setToken} />}
      </Stack.Screen>
      <Stack.Screen name="Register" options={{ headerShown: false }}>
        {(props) => <RegisterScreen {...props} setToken={setToken} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function StudentStack({ setToken }) {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="ClassPicker" options={{ title: "My Classes", headerBackVisible: false }}>
        {(props) => <ClassPickerScreen {...props} setToken={setToken} />}
      </Stack.Screen>
      <Stack.Screen name="Home" options={{ title: "Mark Attendance" }} component={HomeScreen} />
      <Stack.Screen name="Analytics" component={AnalyticsScreen} options={{ title: "My Attendance" }} />
      <Stack.Screen name="Report" component={ReportScreen} options={{ title: "Class Report" }} />
      <Stack.Screen name="Profile" options={{ title: "My Profile" }}>
        {(props) => <ProfileScreen {...props} setToken={setToken} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function LecturerStack({ setToken }) {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="LecturerDashboard" options={{ headerShown: false }}>
        {(props) => <LecturerDashboardScreen {...props} setToken={setToken} />}
      </Stack.Screen>
      <Stack.Screen name="SessionManager" component={SessionManagerScreen} options={{ title: "Manage Sessions" }} />
      <Stack.Screen name="ManageClasses" component={ManageClassesScreen} options={{ title: "Manage Classes" }} />
      <Stack.Screen name="Report" component={ReportScreen} options={{ title: "Class Report" }} />
      <Stack.Screen name="Profile" options={{ title: "My Profile" }}>
        {(props) => <ProfileScreen {...props} setToken={setToken} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function AdminStack({ setToken }) {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="AdminDashboard" options={{ headerShown: false }}>
        {(props) => <AdminDashboardScreen {...props} setToken={setToken} />}
      </Stack.Screen>
      <Stack.Screen name="AdminPeriods" component={AdminPeriodsScreen} options={{ title: "Academic Periods" }} />
      <Stack.Screen name="AdminSemesterReport" component={AdminSemesterReportScreen} options={{ title: "Semester Report" }} />
      <Stack.Screen name="AdminCourses"   component={AdminCoursesScreen}   options={{ title: "Courses" }} />
      <Stack.Screen name="AdminUnits"     component={AdminUnitsScreen}     options={{ title: "Units" }} />
      <Stack.Screen name="AdminLecturers" component={AdminLecturersScreen} options={{ title: "Lecturers & Units" }} />
      <Stack.Screen name="AdminStudents"  component={AdminStudentsScreen}  options={{ title: "Students" }} />
    </Stack.Navigator>
  );
}

export default function App() {
  const [token, setToken]       = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [ready, setReady]       = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      const t   = await SecureStore.getItemAsync("token");
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

  const handleSetToken = async (token, user) => {
    await SecureStore.setItemAsync("token", token);
    await SecureStore.setItemAsync("user", JSON.stringify(user));
    setUserRole(user.role);
    setToken(token);
  };

  if (!ready) return null;

  const renderStack = () => {
    if (!token) return <AuthStack setToken={handleSetToken} />;
    if (userRole === "lecturer") return <LecturerStack setToken={setToken} />;
    if (userRole === "admin")    return <AdminStack    setToken={setToken} />;
    return <StudentStack setToken={setToken} />;
  };

  return (
    <NavigationContainer>
      {renderStack()}
    </NavigationContainer>
  );
}