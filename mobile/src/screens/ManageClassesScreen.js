import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, Modal,
} from "react-native";
import * as Location from "expo-location";
import api from "../services/api";

const EMPTY_FORM = { name: "", courseCode: "", classroomLat: "", classroomLng: "" };

export default function ManageClassesScreen() {
  const [classes, setClasses]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(false);
  const [editId, setEditId]         = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => { fetchClasses(); }, []);

  const fetchClasses = async () => {
    try {
      const { data } = await api.get("/lecturer/classes");
      setClasses(data.classes);
    } catch {
      Alert.alert("Error", "Could not load classes");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setModal(true);
  };

  const openEdit = (cls) => {
    setEditId(cls.id);
    setForm({
      name:         cls.name,
      courseCode:   cls.course_code,
      classroomLat: String(cls.classroom_lat),
      classroomLng: String(cls.classroom_lng),
    });
    setModal(true);
  };

  const useCurrentGPS = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Location access is needed");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setForm(f => ({
        ...f,
        classroomLat: loc.coords.latitude.toFixed(6),
        classroomLng: loc.coords.longitude.toFixed(6),
      }));
    } catch {
      Alert.alert("Error", "Could not get GPS location");
    } finally {
      setGpsLoading(false);
    }
  };

  const handleSave = async () => {
    const { name, courseCode, classroomLat, classroomLng } = form;

    if (!name || !courseCode || !classroomLat || !classroomLng)
      return Alert.alert("Missing fields", "Please fill in all fields including GPS coordinates");

    // Fixed: validate coordinates are real numbers within valid ranges
    const lat = parseFloat(classroomLat);
    const lng = parseFloat(classroomLng);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180)
      return Alert.alert("Invalid coordinates", "Please enter valid GPS coordinates (lat: -90 to 90, lng: -180 to 180)");

    setSaving(true);
    try {
      const payload = { name, courseCode, classroomLat: lat, classroomLng: lng };

      if (editId) {
        await api.put(`/lecturer/classes/${editId}`, payload);
      } else {
        await api.post("/lecturer/classes", payload);
      }

      setModal(false);
      fetchClasses();
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Could not save class");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (cls) => {
    Alert.alert(
      "Delete Class",
      `Are you sure you want to delete "${cls.name}"? All attendance records will also be deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/lecturer/classes/${cls.id}`);
              fetchClasses();
            } catch {
              Alert.alert("Error", "Could not delete class");
            }
          }
        }
      ]
    );
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#4361ee" />;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
        <Text style={styles.addBtnText}>＋  Add New Class</Text>
      </TouchableOpacity>

      <ScrollView>
        {classes.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No classes yet.</Text>
            <Text style={styles.emptyHint}>Tap "Add New Class" to create your first one.</Text>
          </View>
        )}

        {classes.map((cls) => (
          <View key={cls.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{cls.course_code}</Text>
              </View>
              <Text style={styles.className}>{cls.name}</Text>
            </View>
            <Text style={styles.coords}>
              📍 {parseFloat(cls.classroom_lat).toFixed(4)}, {parseFloat(cls.classroom_lng).toFixed(4)}
            </Text>
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(cls)}>
                <Text style={styles.editBtnText}>✏️ Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(cls)}>
                <Text style={styles.deleteBtnText}>🗑 Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Modal for create/edit */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <ScrollView contentContainerStyle={styles.modal}>
          <Text style={styles.modalTitle}>{editId ? "Edit Class" : "New Class"}</Text>

          <TextInput
            style={styles.input}
            placeholder="Class Name"
            placeholderTextColor="#adb5bd"
            value={form.name}
            onChangeText={(v) => setForm(f => ({ ...f, name: v }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Course Code (e.g. CS301)"
            placeholderTextColor="#adb5bd"
            value={form.courseCode}
            onChangeText={(v) => setForm(f => ({ ...f, courseCode: v }))}
          />

          <Text style={styles.venueLabel}>📍 Classroom GPS Venue</Text>

          <TouchableOpacity style={styles.gpsBtn} onPress={useCurrentGPS} disabled={gpsLoading}>
            {gpsLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.gpsBtnText}>📡 Use My Current Location</Text>
            }
          </TouchableOpacity>

          <Text style={styles.orText}>— or enter manually —</Text>

          <TextInput
            style={styles.input}
            placeholder="Latitude (e.g. -1.286389)"
            placeholderTextColor="#adb5bd"
            value={form.classroomLat}
            keyboardType="numeric"
            onChangeText={(v) => setForm(f => ({ ...f, classroomLat: v }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Longitude (e.g. 36.817223)"
            placeholderTextColor="#adb5bd"
            value={form.classroomLng}
            keyboardType="numeric"
            onChangeText={(v) => setForm(f => ({ ...f, classroomLng: v }))}
          />

          {/* Coordinate preview — only shown when both fields have valid numbers */}
          {!isNaN(parseFloat(form.classroomLat)) && !isNaN(parseFloat(form.classroomLng)) && (
            <View style={styles.coordPreview}>
              <Text style={styles.coordPreviewText}>
                ✓ Venue set: {parseFloat(form.classroomLat).toFixed(5)}, {parseFloat(form.classroomLng).toFixed(5)}
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>{editId ? "Update Class" : "Create Class"}</Text>
            }
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
  container:        { flex: 1, padding: 20, backgroundColor: "#f8f9fa" },
  addBtn:           { backgroundColor: "#4361ee", borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 20 },
  addBtnText:       { color: "#fff", fontWeight: "700", fontSize: 15 },
  card:             { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#dee2e6" },
  cardTop:          { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  badge:            { backgroundColor: "#dbe4ff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText:        { color: "#3451b2", fontWeight: "700", fontSize: 12 },
  className:        { fontSize: 15, fontWeight: "600", color: "#1a1a2e", flex: 1 },
  coords:           { fontSize: 12, color: "#6c757d", marginBottom: 12 },
  cardActions:      { flexDirection: "row", gap: 10 },
  editBtn:          { flex: 1, backgroundColor: "#f1f3f5", borderRadius: 8, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "#dee2e6" },
  editBtnText:      { fontSize: 13, fontWeight: "600", color: "#495057" },
  deleteBtn:        { flex: 1, backgroundColor: "#ffe0e0", borderRadius: 8, padding: 10, alignItems: "center" },
  deleteBtnText:    { fontSize: 13, fontWeight: "600", color: "#c0392b" },
  empty:            { alignItems: "center", marginTop: 60 },
  emptyText:        { fontSize: 16, color: "#adb5bd", fontWeight: "600" },
  emptyHint:        { fontSize: 13, color: "#adb5bd", marginTop: 6 },
  modal:            { padding: 28, paddingTop: 48 },
  modalTitle:       { fontSize: 24, fontWeight: "700", color: "#1a1a2e", marginBottom: 24 },
  input:            { backgroundColor: "#f8f9fa", borderRadius: 10, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "#dee2e6", fontSize: 15, color: "#1a1a2e" },
  venueLabel:       { fontSize: 15, fontWeight: "600", color: "#1a1a2e", marginBottom: 12 },
  gpsBtn:           { backgroundColor: "#2d6a4f", borderRadius: 10, padding: 14, alignItems: "center", marginBottom: 14 },
  gpsBtnText:       { color: "#fff", fontWeight: "700", fontSize: 14 },
  orText:           { textAlign: "center", color: "#adb5bd", fontSize: 13, marginBottom: 14 },
  coordPreview:     { backgroundColor: "#d8f3dc", borderRadius: 8, padding: 10, marginBottom: 14 },
  coordPreviewText: { color: "#2d6a4f", fontSize: 13, fontWeight: "600" },
  saveBtn:          { backgroundColor: "#4361ee", borderRadius: 10, padding: 16, alignItems: "center", marginBottom: 12 },
  saveBtnText:      { color: "#fff", fontWeight: "700", fontSize: 16 },
  cancelBtn:        { borderRadius: 10, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#dee2e6" },
  cancelBtnText:    { color: "#6c757d", fontWeight: "600", fontSize: 15 },
});