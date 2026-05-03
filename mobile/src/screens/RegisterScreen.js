import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import api from "../services/api";

export default function RegisterScreen({ navigation, setToken }) {
  const [role, setRole]       = useState("student");
  const [form, setForm]       = useState({
    name: "", email: "", studentId: "", password: "", confirm: "",
    phone: "", department: "",
  });
  const [courses, setCourses]       = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [yearOfStudy, setYearOfStudy]       = useState("");
  const [semester, setSemester]             = useState("");
  const [loading, setLoading]   = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);

  const set = (field) => (val) => setForm((f) => ({ ...f, [field]: val }));

  // Fetch courses when role is student
  useEffect(() => {
    if (role !== "student") return;
    setLoadingCourses(true);
    api.get("/courses")
      .then(({ data }) => setCourses(data.courses || []))
      .catch(() => Alert.alert("Error", "Could not load courses"))
      .finally(() => setLoadingCourses(false));
  }, [role]);

  const handleRegister = async () => {
    const { name, email, studentId, password, confirm, phone, department } = form;

    if (!name || !email || !password)
      return Alert.alert("Missing fields", "Please fill in all required fields");
    if (role === "student" && !studentId)
      return Alert.alert("Missing fields", "Student ID is required");
    if (role === "student" && !selectedCourse)
      return Alert.alert("Missing fields", "Please select your course");
    if (role === "student" && !yearOfStudy)
      return Alert.alert("Missing fields", "Please select your year of study");
    if (role === "student" && !semester)
      return Alert.alert("Missing fields", "Please select your semester");
    if (password !== confirm)
      return Alert.alert("Password mismatch", "Passwords do not match");
    if (password.length < 6)
      return Alert.alert("Weak password", "Password must be at least 6 characters");

    setLoading(true);
    try {
      const payload = { name, email, password, role, phone: phone || undefined };
      if (role === "student") {
        payload.studentId   = studentId;
        payload.courseId    = selectedCourse;
        payload.yearOfStudy = parseInt(yearOfStudy);
        payload.semester    = parseInt(semester);
      }
      if (role === "lecturer") payload.department = department || undefined;

      const { data } = await api.post("/auth/register", payload);
      await setToken(data.token, data.user);
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
          <>
            <TextInput style={styles.input} placeholder="Student ID" placeholderTextColor="#adb5bd"
              value={form.studentId} onChangeText={set("studentId")} autoCapitalize="none" />

            {/* Course picker */}
            <Text style={styles.label}>Course</Text>
            {loadingCourses ? (
              <ActivityIndicator color="#4361ee" style={{ marginBottom: 14 }} />
            ) : (
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={selectedCourse}
                  onValueChange={setSelectedCourse}
                  style={styles.picker}
                >
                  <Picker.Item label="Select your course..." value="" />
                  {courses.map(c => (
                    <Picker.Item key={c.id} label={`${c.name} (${c.code})`} value={c.id} />
                  ))}
                </Picker>
              </View>
            )}

            {/* Year of study */}
            <Text style={styles.label}>Year of Study</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={yearOfStudy} onValueChange={setYearOfStudy} style={styles.picker}>
                <Picker.Item label="Select year..." value="" />
                <Picker.Item label="Year 1" value="1" />
                <Picker.Item label="Year 2" value="2" />
                <Picker.Item label="Year 3" value="3" />
                <Picker.Item label="Year 4" value="4" />
              </Picker>
            </View>

            {/* Semester */}
            <Text style={styles.label}>Current Semester</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={semester} onValueChange={setSemester} style={styles.picker}>
                <Picker.Item label="Select semester..." value="" />
                <Picker.Item label="Semester 1" value="1" />
                <Picker.Item label="Semester 2" value="2" />
              </Picker>
            </View>
          </>
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
            : <Text style={styles.btnText}>
                Register as {role === "student" ? "Student" : "Lecturer"}
              </Text>
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
  container:         { flexGrow: 1, justifyContent: "center", padding: 28, backgroundColor: "#f8f9fa" },
  title:             { fontSize: 30, fontWeight: "700", color: "#1a1a2e", marginBottom: 6 },
  subtitle:          { fontSize: 15, color: "#6c757d", marginBottom: 28 },
  roleRow:           { flexDirection: "row", gap: 12, marginBottom: 24 },
  roleBtn:           { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: "#dee2e6", alignItems: "center", backgroundColor: "#fff" },
  roleBtnActive:     { borderColor: "#4361ee", backgroundColor: "#dbe4ff" },
  roleBtnText:       { fontSize: 14, fontWeight: "600", color: "#6c757d" },
  roleBtnTextActive: { color: "#3451b2" },
  label:             { fontSize: 13, fontWeight: "600", color: "#495057", marginBottom: 6, marginTop: 4 },
  input:             { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "#dee2e6", fontSize: 15, color: "#1a1a2e" },
  pickerWrap:        { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#dee2e6", marginBottom: 14, overflow: "hidden" },
  picker:            { height: 50, color: "#1a1a2e" },
  btn:               { backgroundColor: "#4361ee", borderRadius: 10, padding: 16, alignItems: "center", marginTop: 4, marginBottom: 20 },
  btnText:           { color: "#fff", fontWeight: "700", fontSize: 16 },
  link:              { color: "#4361ee", textAlign: "center", fontSize: 14 },
});