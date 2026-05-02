import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, Image,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import api from "../services/api";

export default function ProfileScreen({ navigation, setToken }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({ name: "", phone: "", department: "" });

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    try {
      const { data } = await api.get("/profile");
      setUser(data.user);
      setForm({
        name:       data.user.name       || "",
        phone:      data.user.phone      || "",
        department: data.user.department || "",
      });
    } catch {
      Alert.alert("Error", "Could not load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/profile", {
        name:       form.name,
        phone:      form.phone,
        department: form.department,
      });
      setUser(data.user);
      await SecureStore.setItemAsync("user", JSON.stringify(data.user));
      setEditing(false);
      Alert.alert("Success", "Profile updated");
    } catch {
      Alert.alert("Error", "Could not update profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo library access");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setSaving(true);
      try {
        const { data } = await api.put("/profile", { profilePhoto: base64 });
        setUser(data.user);
        await SecureStore.setItemAsync("user", JSON.stringify(data.user));
      } catch {
        Alert.alert("Error", "Could not update photo");
      } finally {
        setSaving(false);
      }
    }
  };

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync("token");
    await SecureStore.deleteItemAsync("user");
    setToken(null); //trigger App.js to show AuthStack automatically
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#4361ee" />;

  const isLecturer = user?.role === "lecturer";

  return (
    <ScrollView contentContainerStyle={styles.container}>

      {/* Profile photo */}
      <View style={styles.photoSection}>
        <TouchableOpacity onPress={handlePickPhoto}>
          {user?.profile_photo ? (
            <Image source={{ uri: user.profile_photo }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoInitial}>
                {user?.name?.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.editPhotoBtn}>
            <Text style={styles.editPhotoText}>📷</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.userName}>{user?.name}</Text>

        {/* Role badge */}
        <View style={[styles.roleBadge, isLecturer ? styles.lecturerBadge : styles.studentBadge]}>
          <Text style={styles.roleBadgeText}>
            {isLecturer ? "👨‍🏫 Lecturer" : "🎓 Student"}
          </Text>
        </View>
      </View>

      {/* Info cards */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account Details</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{user?.email}</Text>
        </View>

        {!isLecturer && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Student ID</Text>
            <Text style={styles.infoValue}>{user?.student_id || user?.studentId}</Text>
          </View>
        )}

        {isLecturer && user?.department && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Department</Text>
            <Text style={styles.infoValue}>{user.department}</Text>
          </View>
        )}

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Member since</Text>
          <Text style={styles.infoValue}>
            {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
          </Text>
        </View>
      </View>

      {/* Edit form */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Edit Profile</Text>
          {!editing && (
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Text style={styles.editBtn}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        <TextInput
          style={[styles.input, !editing && styles.inputDisabled]}
          placeholder="Full Name"
          placeholderTextColor="#adb5bd"
          value={form.name}
          onChangeText={(v) => setForm(f => ({ ...f, name: v }))}
          editable={editing}
        />
        <TextInput
          style={[styles.input, !editing && styles.inputDisabled]}
          placeholder="Phone Number"
          placeholderTextColor="#adb5bd"
          value={form.phone}
          onChangeText={(v) => setForm(f => ({ ...f, phone: v }))}
          editable={editing}
          keyboardType="phone-pad"
        />
        {isLecturer && (
          <TextInput
            style={[styles.input, !editing && styles.inputDisabled]}
            placeholder="Department"
            placeholderTextColor="#adb5bd"
            value={form.department}
            onChangeText={(v) => setForm(f => ({ ...f, department: v }))}
            editable={editing}
          />
        )}

        {editing && (
          <View style={styles.editActions}>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>Save Changes</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setEditing(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:       { flexGrow: 1, padding: 24, backgroundColor: "#f8f9fa" },
  photoSection:    { alignItems: "center", marginBottom: 24 },
  photo:           { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: "#4361ee" },
  photoPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: "#dbe4ff", alignItems: "center", justifyContent: "center" },
  photoInitial:    { fontSize: 40, fontWeight: "700", color: "#3451b2" },
  editPhotoBtn:    { position: "absolute", bottom: 0, right: 0, backgroundColor: "#4361ee", borderRadius: 14, width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  editPhotoText:   { fontSize: 14 },
  userName:        { fontSize: 22, fontWeight: "700", color: "#1a1a2e", marginTop: 12 },
  roleBadge:       { marginTop: 8, paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20 },
  lecturerBadge:   { backgroundColor: "#FAEEDA" },
  studentBadge:    { backgroundColor: "#dbe4ff" },
  roleBadgeText:   { fontSize: 13, fontWeight: "600", color: "#1a1a2e" },
  card:            { backgroundColor: "#fff", borderRadius: 12, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: "#dee2e6" },
  cardHeader:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  cardTitle:       { fontSize: 15, fontWeight: "700", color: "#1a1a2e" },
  editBtn:         { color: "#4361ee", fontWeight: "600", fontSize: 14 },
  infoRow:         { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f3f5" },
  infoLabel:       { fontSize: 13, color: "#6c757d" },
  infoValue:       { fontSize: 13, fontWeight: "600", color: "#1a1a2e", flex: 1, textAlign: "right" },
  input:           { backgroundColor: "#f8f9fa", borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#dee2e6", fontSize: 15, color: "#1a1a2e" },
  inputDisabled:   { backgroundColor: "#f1f3f5", color: "#6c757d" },
  editActions:     { gap: 10 },
  saveBtn:         { backgroundColor: "#4361ee", borderRadius: 10, padding: 14, alignItems: "center" },
  saveBtnText:     { color: "#fff", fontWeight: "700", fontSize: 15 },
  cancelBtn:       { borderRadius: 10, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#dee2e6" },
  cancelBtnText:   { color: "#6c757d", fontWeight: "600", fontSize: 15 },
  logoutBtn:       { backgroundColor: "#ffe0e0", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
  logoutText:      { color: "#e63946", fontWeight: "700", fontSize: 16 },
});