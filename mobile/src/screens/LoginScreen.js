import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import api from "../services/api";

export default function LoginScreen({ navigation, setToken }) {
  const [role, setRole]             = useState("student");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword]     = useState("");
  const [loading, setLoading]       = useState(false);

  const switchRole = (newRole) => { setRole(newRole); setIdentifier(""); };

  const handleLogin = async () => {
    if (!identifier || !password)
      return Alert.alert("Missing fields", "Please fill in all fields");
    if (role !== "student" && !identifier.includes("@"))
      return Alert.alert("Invalid email", "Please enter a valid email address");

    setLoading(true);
    try {
      const payload = { password, role };
      if (role === "student") payload.studentId = identifier;
      else                    payload.email     = identifier;

      const { data } = await api.post("/auth/login", payload);
      await setToken(data.token, data.user);
    } catch (err) {
      Alert.alert("Login failed", err.response?.data?.error || "Check your credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleBiometric = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled  = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !isEnrolled) {
      Alert.alert("Not available", "Biometric auth not set up on this device");
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Authenticate to continue" });
    if (result.success) {
      const token = await SecureStore.getItemAsync("token");
      const raw   = await SecureStore.getItemAsync("user");
      if (token && raw) {
        try {
          await api.get("/profile", { headers: { Authorization: `Bearer ${token}` } });
          const user = JSON.parse(raw);
          await setToken(token, user);
        } catch {
          await SecureStore.deleteItemAsync("token");
          await SecureStore.deleteItemAsync("user");
          Alert.alert("Session expired", "Please log in with your password");
        }
      } else {
        Alert.alert("Please log in with your password first");
      }
    }
  };

  const roles = [
    { key: "student",  label: "🎓 Student"  },
    { key: "lecturer", label: "👨‍🏫 Lecturer" },
    { key: "admin",    label: "⚙️ Admin"     },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>GPS Attendance</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>

      {/* Role selector — three options */}
      <View style={styles.roleRow}>
        {roles.map(r => (
          <TouchableOpacity
            key={r.key}
            style={[styles.roleBtn, role === r.key && styles.roleBtnActive]}
            onPress={() => switchRole(r.key)}
          >
            <Text style={[styles.roleBtnText, role === r.key && styles.roleBtnTextActive]}>
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.input}
        placeholder={role === "student" ? "Student ID" : "Email Address"}
        placeholderTextColor="#adb5bd"
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        keyboardType={role === "student" ? "default" : "email-address"}
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
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Log In</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.biometricBtn} onPress={handleBiometric}>
        <Text style={styles.biometricText}>Use Biometric Login</Text>
      </TouchableOpacity>

      {/* Only students and lecturers can self-register — admin is created manually */}
      {role !== "admin" && (
        <TouchableOpacity onPress={() => navigation.navigate("Register")}>
          <Text style={styles.link}>Don't have an account? Register</Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, justifyContent: "center", padding: 28, backgroundColor: "#f8f9fa" },
  title:             { fontSize: 30, fontWeight: "700", color: "#1a1a2e", marginBottom: 6 },
  subtitle:          { fontSize: 15, color: "#6c757d", marginBottom: 28 },
  roleRow:           { flexDirection: "row", gap: 8, marginBottom: 20 },
  roleBtn:           { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: "#dee2e6", alignItems: "center", backgroundColor: "#fff" },
  roleBtnActive:     { borderColor: "#4361ee", backgroundColor: "#dbe4ff" },
  roleBtnText:       { fontSize: 12, fontWeight: "600", color: "#6c757d" },
  roleBtnTextActive: { color: "#3451b2" },
  input:             { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "#dee2e6", fontSize: 15, color: "#1a1a2e" },
  btn:               { backgroundColor: "#4361ee", borderRadius: 10, padding: 16, alignItems: "center", marginBottom: 12 },
  btnText:           { color: "#fff", fontWeight: "700", fontSize: 16 },
  biometricBtn:      { borderRadius: 10, padding: 15, alignItems: "center", borderWidth: 1, borderColor: "#4361ee", marginBottom: 28 },
  biometricText:     { color: "#4361ee", fontWeight: "600", fontSize: 15 },
  link:              { color: "#4361ee", textAlign: "center", fontSize: 14 },
});