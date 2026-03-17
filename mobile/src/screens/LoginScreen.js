import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView, Platform,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View,
} from "react-native";
import api from "../services/api";
import { registerForPushNotifications, sendLocalNotification } from "../services/notifications";

export default function LoginScreen({ navigation }) {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword]   = useState("");
  const [loading, setLoading]     = useState(false);

  const afterLogin = async () => {
    // Register for push notifications after login
    const token = await registerForPushNotifications();
    if (token) {
      await SecureStore.setItemAsync("pushToken", token);
    }
    // Welcome notification
    await sendLocalNotification(
      "Welcome back! 👋",
      "GPS Attendance is ready. Select your class to mark attendance."
    );
    navigation.replace("ClassPicker");
  };

  const handleLogin = async () => {
    if (!studentId || !password) {
      Alert.alert("Missing fields", "Please enter your Student ID and password");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { studentId, password });
      await SecureStore.setItemAsync("token", data.token);
      await SecureStore.setItemAsync("student", JSON.stringify(data.student));
      await afterLogin();
    } catch (err) {
      Alert.alert("Login failed", err.response?.data?.error || "Check your credentials and try again");
    } finally {
      setLoading(false);
    }
  };

  const handleBiometric = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled  = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      Alert.alert("Not available", "Biometric auth is not set up on this device");
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Authenticate to sign attendance",
      fallbackLabel: "Use password instead",
    });

    if (result.success) {
      const token = await SecureStore.getItemAsync("token");
      if (token) {
        await afterLogin();
      } else {
        Alert.alert("Please log in with your password first");
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.title}>GPS Attendance</Text>
        <Text style={styles.subtitle}>Sign in to mark your attendance</Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Student ID"
        placeholderTextColor="#adb5bd"
        value={studentId}
        onChangeText={setStudentId}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#adb5bd"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Log In</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity style={styles.biometricBtn} onPress={handleBiometric}>
        <Text style={styles.biometricText}>🔒  Use Biometric Login</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("Register")}>
        <Text style={styles.link}>Don't have an account? Register</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, justifyContent: "center", padding: 28, backgroundColor: "#f8f9fa" },
  header:        { marginBottom: 36 },
  title:         { fontSize: 30, fontWeight: "700", color: "#1a1a2e" },
  subtitle:      { fontSize: 15, color: "#6c757d", marginTop: 6 },
  input: {
    backgroundColor: "#fff", borderRadius: 10, padding: 14,
    marginBottom: 14, borderWidth: 1, borderColor: "#dee2e6",
    fontSize: 15, color: "#1a1a2e",
  },
  btn:           { backgroundColor: "#4361ee", borderRadius: 10, padding: 16, alignItems: "center", marginBottom: 12 },
  btnText:       { color: "#fff", fontWeight: "700", fontSize: 16 },
  biometricBtn:  { borderRadius: 10, padding: 15, alignItems: "center", borderWidth: 1, borderColor: "#4361ee", marginBottom: 28 },
  biometricText: { color: "#4361ee", fontWeight: "600", fontSize: 15 },
  link:          { color: "#4361ee", textAlign: "center", fontSize: 14 },
});