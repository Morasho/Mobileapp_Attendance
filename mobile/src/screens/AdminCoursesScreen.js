import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, Modal, RefreshControl,
} from "react-native";
import api from "../services/api";

const EMPTY = { name: "", code: "", department: "" };

export default function AdminCoursesScreen() {
  const [courses, setCourses]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal]       = useState(false);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/courses");
      setCourses(data.courses || []);
    } catch {
      Alert.alert("Error", "Could not load courses");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); };
  const set = (f) => (v) => setForm(p => ({ ...p, [f]: v }));

  const handleSave = async () => {
    if (!form.name || !form.code)
      return Alert.alert("Missing fields", "Course name and code are required");
    setSaving(true);
    try {
      await api.post("/admin/courses", {
        name:       form.name,
        code:       form.code.toUpperCase(),
        department: form.department || undefined,
      });
      setModal(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Could not create course");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (course) => {
    Alert.alert(
      "Delete Course",
      `Delete "${course.name}"? This will also delete all its units and classes.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/admin/courses/${course.id}`);
              load();
            } catch {
              Alert.alert("Error", "Could not delete course");
            }
          },
        },
      ]
    );
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#4361ee" />;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addBtn} onPress={() => { setForm(EMPTY); setModal(true); }}>
        <Text style={styles.addBtnText}>＋  Add Course</Text>
      </TouchableOpacity>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4361ee" />}>
        {courses.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No courses yet.</Text>
            <Text style={styles.emptyHint}>Add a course to get started.</Text>
          </View>
        )}
        {courses.map(c => (
          <View key={c.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{c.code}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.name}</Text>
                {c.department ? <Text style={styles.meta}>{c.department}</Text> : null}
              </View>
            </View>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(c)}>
              <Text style={styles.deleteBtnText}>🗑 Delete</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <ScrollView contentContainerStyle={styles.modal}>
          <Text style={styles.modalTitle}>New Course</Text>
          <TextInput style={styles.input} placeholder="Course Name (e.g. BSc Computer Science)"
            placeholderTextColor="#adb5bd" value={form.name} onChangeText={set("name")} autoCapitalize="words" />
          <TextInput style={styles.input} placeholder="Code (e.g. BCS)"
            placeholderTextColor="#adb5bd" value={form.code} onChangeText={set("code")} autoCapitalize="characters" />
          <TextInput style={styles.input} placeholder="Department (optional)"
            placeholderTextColor="#adb5bd" value={form.department} onChangeText={set("department")} autoCapitalize="words" />
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Create Course</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setModal(false)}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, padding: 20, backgroundColor: "#f8f9fa" },
  addBtn:       { backgroundColor: "#4361ee", borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 16 },
  addBtnText:   { color: "#fff", fontWeight: "700", fontSize: 15 },
  card:         { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#dee2e6" },
  cardTop:      { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  badge:        { backgroundColor: "#dbe4ff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText:    { color: "#3451b2", fontWeight: "700", fontSize: 12 },
  name:         { fontSize: 15, fontWeight: "600", color: "#1a1a2e" },
  meta:         { fontSize: 12, color: "#6c757d", marginTop: 2 },
  deleteBtn:    { backgroundColor: "#ffe0e0", borderRadius: 8, padding: 10, alignItems: "center" },
  deleteBtnText:{ fontSize: 13, fontWeight: "600", color: "#c0392b" },
  empty:        { alignItems: "center", marginTop: 60 },
  emptyText:    { fontSize: 16, color: "#adb5bd", fontWeight: "600" },
  emptyHint:    { fontSize: 13, color: "#adb5bd", marginTop: 6 },
  modal:        { padding: 28, paddingTop: 48 },
  modalTitle:   { fontSize: 24, fontWeight: "700", color: "#1a1a2e", marginBottom: 24 },
  input:        { backgroundColor: "#f8f9fa", borderRadius: 10, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "#dee2e6", fontSize: 15, color: "#1a1a2e" },
  saveBtn:      { backgroundColor: "#4361ee", borderRadius: 10, padding: 16, alignItems: "center", marginBottom: 12 },
  saveBtnText:  { color: "#fff", fontWeight: "700", fontSize: 16 },
  cancelBtn:    { borderRadius: 10, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#dee2e6" },
  cancelBtnText:{ color: "#6c757d", fontWeight: "600", fontSize: 15 },
});