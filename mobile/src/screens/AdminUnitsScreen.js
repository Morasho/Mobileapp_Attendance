import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, Modal, RefreshControl,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import api from "../services/api";

const EMPTY = { name: "", code: "", courseId: "", yearOfStudy: "", semester: "" };

export default function AdminUnitsScreen() {
  const [units, setUnits]       = useState([]);
  const [courses, setCourses]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal]       = useState(false);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);

  // Filter state
  const [filterCourse, setFilterCourse] = useState("");
  const [filterYear, setFilterYear]     = useState("");

  const load = useCallback(async () => {
    try {
      const [unitRes, courseRes] = await Promise.all([
        api.get("/admin/units"),
        api.get("/admin/courses"),
      ]);
      setUnits(unitRes.data.units || []);
      setCourses(courseRes.data.courses || []);
    } catch {
      Alert.alert("Error", "Could not load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); };
  const set = (f) => (v) => setForm(p => ({ ...p, [f]: v }));

  const handleSave = async () => {
    if (!form.name || !form.code || !form.courseId || !form.yearOfStudy || !form.semester)
      return Alert.alert("Missing fields", "All fields are required");
    setSaving(true);
    try {
      await api.post("/admin/units", {
        name:        form.name,
        code:        form.code.toUpperCase(),
        courseId:    form.courseId,
        yearOfStudy: parseInt(form.yearOfStudy),
        semester:    parseInt(form.semester),
      });
      setModal(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Could not create unit");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (unit) => {
    Alert.alert(
      "Delete Unit",
      `Delete "${unit.name}"? This will also delete all classes and attendance records for this unit.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/admin/units/${unit.id}`);
              load();
            } catch {
              Alert.alert("Error", "Could not delete unit");
            }
          },
        },
      ]
    );
  };

  // Filter units
  const filtered = units.filter(u => {
    if (filterCourse && u.course_id !== filterCourse) return false;
    if (filterYear   && String(u.year_of_study) !== filterYear) return false;
    return true;
  });

  // Group by course → year
  const grouped = {};
  filtered.forEach(u => {
    const cKey = u.course_name || "Unknown";
    const yKey = `Year ${u.year_of_study}`;
    if (!grouped[cKey]) grouped[cKey] = {};
    if (!grouped[cKey][yKey]) grouped[cKey][yKey] = [];
    grouped[cKey][yKey].push(u);
  });

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#4361ee" />;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addBtn} onPress={() => { setForm(EMPTY); setModal(true); }}>
        <Text style={styles.addBtnText}>＋  Add Unit</Text>
      </TouchableOpacity>

      {/* Filters */}
      <View style={styles.filterRow}>
        <View style={[styles.pickerWrap, { flex: 2 }]}>
          <Picker selectedValue={filterCourse} onValueChange={setFilterCourse} style={styles.picker}>
            <Picker.Item label="All courses" value="" />
            {courses.map(c => <Picker.Item key={c.id} label={c.code} value={c.id} />)}
          </Picker>
        </View>
        <View style={[styles.pickerWrap, { flex: 1 }]}>
          <Picker selectedValue={filterYear} onValueChange={setFilterYear} style={styles.picker}>
            <Picker.Item label="All years" value="" />
            {[1,2,3,4].map(y => <Picker.Item key={y} label={`Yr ${y}`} value={String(y)} />)}
          </Picker>
        </View>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4361ee" />}>
        {Object.keys(grouped).length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No units found.</Text>
            <Text style={styles.emptyHint}>Tap "Add Unit" to create your first unit.</Text>
          </View>
        )}

        {Object.entries(grouped).map(([courseName, years]) => (
          <View key={courseName}>
            <View style={styles.courseHeader}>
              <Text style={styles.courseName}>📖 {courseName}</Text>
            </View>
            {Object.entries(years).map(([yearLabel, unitList]) => (
              <View key={yearLabel}>
                <Text style={styles.yearLabel}>{yearLabel}</Text>
                {unitList.map(u => (
                  <View key={u.id} style={styles.card}>
                    <View style={styles.cardTop}>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{u.code}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{u.name}</Text>
                        <Text style={styles.meta}>Semester {u.semester}</Text>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(u)}>
                      <Text style={styles.deleteBtnText}>🗑 Delete</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <ScrollView contentContainerStyle={styles.modal}>
          <Text style={styles.modalTitle}>New Unit</Text>

          <TextInput style={styles.input} placeholder="Unit Name (e.g. Data Structures)"
            placeholderTextColor="#adb5bd" value={form.name} onChangeText={set("name")} autoCapitalize="words" />
          <TextInput style={styles.input} placeholder="Unit Code (e.g. CS201)"
            placeholderTextColor="#adb5bd" value={form.code} onChangeText={set("code")} autoCapitalize="characters" />

          <Text style={styles.label}>Course</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={form.courseId} onValueChange={set("courseId")} style={styles.picker}>
              <Picker.Item label="Select course..." value="" />
              {courses.map(c => <Picker.Item key={c.id} label={`${c.name} (${c.code})`} value={c.id} />)}
            </Picker>
          </View>

          <Text style={styles.label}>Year of Study</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={form.yearOfStudy} onValueChange={set("yearOfStudy")} style={styles.picker}>
              <Picker.Item label="Select year..." value="" />
              {[1,2,3,4].map(y => <Picker.Item key={y} label={`Year ${y}`} value={String(y)} />)}
            </Picker>
          </View>

          <Text style={styles.label}>Semester</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={form.semester} onValueChange={set("semester")} style={styles.picker}>
              <Picker.Item label="Select semester..." value="" />
              <Picker.Item label="Semester 1" value="1" />
              <Picker.Item label="Semester 2" value="2" />
            </Picker>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Create Unit</Text>}
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
  addBtn:       { backgroundColor: "#4361ee", borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 12 },
  addBtnText:   { color: "#fff", fontWeight: "700", fontSize: 15 },
  filterRow:    { flexDirection: "row", gap: 8, marginBottom: 16 },
  courseHeader: { backgroundColor: "#dbe4ff", borderRadius: 10, padding: 12, marginTop: 12, marginBottom: 8 },
  courseName:   { fontSize: 14, fontWeight: "700", color: "#3451b2" },
  yearLabel:    { fontSize: 12, fontWeight: "700", color: "#6c757d", marginBottom: 8, marginLeft: 4, textTransform: "uppercase", letterSpacing: 0.5 },
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
  label:        { fontSize: 13, fontWeight: "600", color: "#495057", marginBottom: 8 },
  input:        { backgroundColor: "#f8f9fa", borderRadius: 10, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "#dee2e6", fontSize: 15, color: "#1a1a2e" },
  pickerWrap:   { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#dee2e6", marginBottom: 16, overflow: "hidden" },
  picker:       { height: 50, color: "#1a1a2e" },
  saveBtn:      { backgroundColor: "#4361ee", borderRadius: 10, padding: 16, alignItems: "center", marginBottom: 12 },
  saveBtnText:  { color: "#fff", fontWeight: "700", fontSize: 16 },
  cancelBtn:    { borderRadius: 10, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#dee2e6" },
  cancelBtnText:{ color: "#6c757d", fontWeight: "600", fontSize: 15 },
});