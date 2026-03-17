import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View,
} from "react-native";
import api from "../services/api";
import { registerForPushNotifications, sendLocalNotification } from "../services/notifications";

export default function RegisterScreen({ navigation }) {
  const [form, setForm] = useState({
    name: "", email: "", studentId: "", password: "", confirm: "",
  });
  const [loading, setLoading] = useState(false);

  const set = (field) => (val) => setForm((f) => ({ ...f, [field]: val }));

  const handleRegister = async () => {
    const { name, email, studentId, password, confirm } = form;

    if (!name || !email || !studentId || !password)
      return Alert.alert("Missing fields", "Please fill in all fields");
    if (password !== confirm)
      return Alert.alert("Password mismatch", "Passwords do not match");
    if (password.length < 6)
      return Alert.alert("Weak password", "Password must be at least 6 characters");

    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", { name, email, studentId, password });
      await SecureStore.setItemAsync("token", data.token);
      await SecureStore.setItemAsync("student", JSON.stringify(data.student));

      // Register for push notifications after successful registration
      const pushToken = await registerForPushNotifications();
      if (pushToken) await SecureStore.setItemAsync("pushToken", pushToken);

      // Welcome notification
      await sendLocalNotification(
        "Welcome to GPS Attendance! 🎉",
        "Your account is ready. Select a class to mark your first attendance."
      );

      navigation.replace("ClassPicker");
    } catch (err) {
      Alert.alert("Registration failed", err.response?.data?.error || "Please try again");
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: "name",      label: "Full Name",       secure: false, caps: "words",  keyboard: "default"       },
    { key: "email",     label: "Email Address",    secure: false, caps: "none",   keyboard: "email-address" },
    { key: "studentId", label: "Student ID",       secure: false, caps: "none",   keyboard: "default"       },
    { key: "password",  label: "Password",         secure: true,  caps: "none",   keyboard: "default"       },
    { key: "confirm",   label: "Confirm Password", secure: true,  caps: "none",   keyboard: "default"       },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Register with your student details</Text>
        </View>

        {fields.map(({ key, label, secure, caps, keyboard }) => (
          <TextInput
            key={key}
            style={styles.input}
            placeholder={label}
            placeholderTextColor="#adb5bd"
            value={form[key]}
            onChangeText={set(key)}
            secureTextEntry={secure}
            autoCapitalize={caps}
            keyboardType={keyboard}
          />
        ))}

        <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Register</Text>
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
  container:  { flexGrow: 1, justifyContent: "center", padding: 28, backgroundColor: "#f8f9fa" },
  header:     { marginBottom: 32 },
  title:      { fontSize: 30, fontWeight: "700", color: "#1a1a2e" },
  subtitle:   { fontSize: 15, color: "#6c757d", marginTop: 6 },
  input: {
    backgroundColor: "#fff", borderRadius: 10, padding: 14,
    marginBottom: 14, borderWidth: 1, borderColor: "#dee2e6",
    fontSize: 15, color: "#1a1a2e",
  },
  btn:      { backgroundColor: "#4361ee", borderRadius: 10, padding: 16, alignItems: "center", marginTop: 4, marginBottom: 20 },
  btnText:  { color: "#fff", fontWeight: "700", fontSize: 16 },
  link:     { color: "#4361ee", textAlign: "center", fontSize: 14 },
});