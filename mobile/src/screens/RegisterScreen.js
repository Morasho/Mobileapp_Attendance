import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import api from "../services/api";

export default function RegisterScreen({ navigation, setToken }) {
  const [role, setRole]     = useState("student");
  const [form, setForm]     = useState({
    name: "", email: "", studentId: "", password: "", confirm: "", phone: "", department: "",
  });
  const [loading, setLoading] = useState(false);

  const set = (field) => (val) => setForm((f) => ({ ...f, [field]: val }));

  const handleRegister = async () => {
    const { name, email, studentId, password, confirm, phone, department } = form;

    if (!name || !email || !password)
      return Alert.alert("Missing fields", "Please fill in all required fields");
    if (role === "student" && !studentId)
      return Alert.alert("Missing fields", "Student ID is required");
    if (password !== confirm)
      return Alert.alert("Password mismatch", "Passwords do not match");
    if (password.length < 6)
      return Alert.alert("Weak password", "Password must be at least 6 characters");

    setLoading(true);
    try {
      const payload = { name, email, password, role, phone };
      if (role === "student")  payload.studentId  = studentId;
      if (role === "lecturer") payload.department = department;

      const { data } = await api.post("/auth/register", payload);
      await setToken(data.token, data.user);  // pass user info to App for role-based routing
    } catch (err) {
      Alert.alert("Registration failed", err.response?.data?.error || "Please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Register as a student or lecturer</Text>

        {/* Role selector */}
        <View style={styles.roleRow}>
          <TouchableOpacity
            style={[styles.roleBtn, role === "student" && styles.roleBtnActive]}
            onPress={() => setRole("student")}
          >
            <Text style={[styles.roleBtnText, role === "student" && styles.roleBtnTextActive]}>
              🎓 Student
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleBtn, role === "lecturer" && styles.roleBtnActive]}
            onPress={() => setRole("lecturer")}
          >
            <Text style={[styles.roleBtnText, role === "lecturer" && styles.roleBtnTextActive]}>
              👨‍🏫 Lecturer
            </Text>
          </TouchableOpacity>
        </View>

        {/* Common fields */}
        <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor="#adb5bd"
          value={form.name} onChangeText={set("name")} autoCapitalize="words" />
        <TextInput style={styles.input} placeholder="Email Address" placeholderTextColor="#adb5bd"
          value={form.email} onChangeText={set("email")} autoCapitalize="none" keyboardType="email-address" />
        <TextInput style={styles.input} placeholder="Phone (optional)" placeholderTextColor="#adb5bd"
          value={form.phone} onChangeText={set("phone")} keyboardType="phone-pad" />

        {/* Student-only fields */}
        {role === "student" && (
          <TextInput style={styles.input} placeholder="Student ID" placeholderTextColor="#adb5bd"
            value={form.studentId} onChangeText={set("studentId")} autoCapitalize="none" />
        )}

        {/* Lecturer-only fields */}
        {role === "lecturer" && (
          <TextInput style={styles.input} placeholder="Department (optional)" placeholderTextColor="#adb5bd"
            value={form.department} onChangeText={set("department")} autoCapitalize="words" />
        )}

        <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#adb5bd"
          value={form.password} onChangeText={set("password")} secureTextEntry />
        <TextInput style={styles.input} placeholder="Confirm Password" placeholderTextColor="#adb5bd"
          value={form.confirm} onChangeText={set("confirm")} secureTextEntry />

        <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Register as {role === "student" ? "Student" : "Lecturer"}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Login")}>
          <Text style={styles.link}>Already have an account? Log in</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:       { flexGrow: 1, justifyContent: "center", padding: 28, backgroundColor: "#f8f9fa" },
  title:           { fontSize: 30, fontWeight: "700", color: "#1a1a2e", marginBottom: 6 },
  subtitle:        { fontSize: 15, color: "#6c757d", marginBottom: 28 },
  roleRow:         { flexDirection: "row", gap: 12, marginBottom: 24 },
  roleBtn:         { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: "#dee2e6", alignItems: "center", backgroundColor: "#fff" },
  roleBtnActive:   { borderColor: "#4361ee", backgroundColor: "#dbe4ff" },
  roleBtnText:     { fontSize: 14, fontWeight: "600", color: "#6c757d" },
  roleBtnTextActive: { color: "#3451b2" },
  input:           { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "#dee2e6", fontSize: 15, color: "#1a1a2e" },
  btn:             { backgroundColor: "#4361ee", borderRadius: 10, padding: 16, alignItems: "center", marginTop: 4, marginBottom: 20 },
  btnText:         { color: "#fff", fontWeight: "700", fontSize: 16 },
  link:            { color: "#4361ee", textAlign: "center", fontSize: 14 },
});