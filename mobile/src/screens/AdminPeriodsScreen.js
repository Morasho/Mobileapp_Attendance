import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, Modal, RefreshControl,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import api from "../services/api";

const EMPTY = { name: "", academicYear: "", semester: "", startDate: "", endDate: "" };

export default function AdminPeriodsScreen() {
  const [periods, setPeriods]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal]         = useState(false);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/periods");
      setPeriods(data.periods || []);
    } catch {
      Alert.alert("Error", "Could not load periods");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); };
  const set = (f) => (v) => setForm(p => ({ ...p, [f]: v }));

  const handleSave = async () => {
    if (!form.name || !form.academicYear || !form.semester || !form.startDate || !form.endDate)
      return Alert.alert("Missing fields", "All fields are required");
    setSaving(true);
    try {
      await api.post("/admin/periods", {
        name:         form.name,
        academicYear: form.academicYear,
        semester:     parseInt(form.semester),
        startDate:    form.startDate,
        endDate:      form.endDate,
      });
      setModal(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Could not create period");
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = (period) => {
    Alert.alert(
      "Activate Period",
      `Set "${period.name}" as the active semester?\n\nThis will deactivate the current semester. All new sessions will be linked to this period.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Activate", style: "default",
          onPress: async () => {
            try {
              await api.put(`/admin/periods/${period.id}/activate`);
              load();
            } catch {
              Alert.alert("Error", "Could not activate period");
            }
          },
        },
      ]
    );
  };

  const handleDelete = (period) => {
    Alert.alert(
      "Delete Period",
      `Delete "${period.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/admin/periods/${period.id}`);
              load();
            } catch (err) {
              Alert.alert("Error", err.response?.data?.error || "Could not delete period");
            }
          },
        },
      ]
    );
  };

  const activePeriod = periods.find(p => p.is_active);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#4361ee" />;

  return (
    <View style={styles.container}>
      {/* Active period banner */}
      {activePeriod ? (
        <View style={styles.activeBanner}>
          <Text style={styles.activeBannerTitle}>🟢 Active: {activePeriod.name}</Text>
          <Text style={styles.activeBannerSub}>
            {activePeriod.start_date?.split("T")[0]} → {activePeriod.end_date?.split("T")[0]}
          </Text>
        </View>
      ) : (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>⚠️ No active period — activate one below</Text>
        </View>
      )}

      <TouchableOpacity style={styles.addBtn} onPress={() => { setForm(EMPTY); setModal(true); }}>
        <Text style={styles.addBtnText}>＋  New Academic Period</Text>
      </TouchableOpacity>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4361ee" />}>
        {periods.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No periods yet.</Text>
            <Text style={styles.emptyHint}>Create your first academic period to get started.</Text>
          </View>
        )}

        {periods.map(p => (
          <View key={p.id} style={[styles.card, p.is_active && styles.cardActive]}>
            <View style={styles.cardTop}>
              <View style={[styles.badge, p.is_active && styles.badgeActive]}>
                <Text style={[styles.badgeText, p.is_active && styles.badgeTextActive]}>
                  {p.is_active ? "ACTIVE" : `Sem ${p.semester}`}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.name}</Text>
                <Text style={styles.meta}>
                  {p.start_date?.split("T")[0]} → {p.end_date?.split("T")[0]}
                </Text>
              </View>
            </View>

            <View style={styles.cardActions}>
              {!p.is_active && (
                <TouchableOpacity style={styles.activateBtn} onPress={() => handleActivate(p)}>
                  <Text style={styles.activateBtnText}>✓ Set Active</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.reportBtn}
                onPress={() => Alert.alert("Coming soon", "Semester report will open here")}
              >
                <Text style={styles.reportBtnText}>📊 Report</Text>
              </TouchableOpacity>
              {!p.is_active && (
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(p)}>
                  <Text style={styles.deleteBtnText}>🗑</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <ScrollView contentContainerStyle={styles.modal}>
          <Text style={styles.modalTitle}>New Academic Period</Text>

          <TextInput style={styles.input} placeholder='Name (e.g. "2024/2025 Semester 1")'
            placeholderTextColor="#adb5bd" value={form.name} onChangeText={set("name")} />
          <TextInput style={styles.input} placeholder="Academic Year (e.g. 2024/2025)"
            placeholderTextColor="#adb5bd" value={form.academicYear} onChangeText={set("academicYear")} />

          <Text style={styles.label}>Semester</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={form.semester} onValueChange={set("semester")} style={styles.picker}>
              <Picker.Item label="Select semester..." value="" />
              <Picker.Item label="Semester 1" value="1" />
              <Picker.Item label="Semester 2" value="2" />
            </Picker>
          </View>

          <TextInput style={styles.input} placeholder="Start Date (YYYY-MM-DD)"
            placeholderTextColor="#adb5bd" value={form.startDate} onChangeText={set("startDate")} />
          <TextInput style={styles.input} placeholder="End Date (YYYY-MM-DD)"
            placeholderTextColor="#adb5bd" value={form.endDate} onChangeText={set("endDate")} />

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Create Period</Text>}
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
  container:          { flex: 1, padding: 20, backgroundColor: "#f8f9fa" },
  activeBanner:       { backgroundColor: "#d8f3dc", borderRadius: 12, padding: 14, marginBottom: 14 },
  activeBannerTitle:  { fontSize: 14, fontWeight: "700", color: "#2d6a4f" },
  activeBannerSub:    { fontSize: 12, color: "#2d6a4f", marginTop: 3 },
  warningBanner:      { backgroundColor: "#fff3bf", borderRadius: 12, padding: 14, marginBottom: 14 },
  warningText:        { fontSize: 13, fontWeight: "600", color: "#856404" },
  addBtn:             { backgroundColor: "#4361ee", borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 16 },
  addBtnText:         { color: "#fff", fontWeight: "700", fontSize: 15 },
  card:               { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#dee2e6" },
  cardActive:         { borderColor: "#2d6a4f", backgroundColor: "#f0fdf4" },
  cardTop:            { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  badge:              { backgroundColor: "#f1f3f5", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  badgeActive:        { backgroundColor: "#2d6a4f" },
  badgeText:          { color: "#495057", fontWeight: "700", fontSize: 11 },
  badgeTextActive:    { color: "#fff" },
  name:               { fontSize: 15, fontWeight: "600", color: "#1a1a2e" },
  meta:               { fontSize: 12, color: "#6c757d", marginTop: 2 },
  cardActions:        { flexDirection: "row", gap: 8 },
  activateBtn:        { flex: 2, backgroundColor: "#d8f3dc", borderRadius: 8, padding: 10, alignItems: "center" },
  activateBtnText:    { color: "#2d6a4f", fontWeight: "700", fontSize: 13 },
  reportBtn:          { flex: 2, backgroundColor: "#dbe4ff", borderRadius: 8, padding: 10, alignItems: "center" },
  reportBtnText:      { color: "#3451b2", fontWeight: "700", fontSize: 13 },
  deleteBtn:          { backgroundColor: "#ffe0e0", borderRadius: 8, padding: 10, alignItems: "center", width: 44 },
  deleteBtnText:      { fontSize: 14 },
  empty:              { alignItems: "center", marginTop: 60 },
  emptyText:          { fontSize: 16, color: "#adb5bd", fontWeight: "600" },
  emptyHint:          { fontSize: 13, color: "#adb5bd", marginTop: 6, textAlign: "center" },
  modal:              { padding: 28, paddingTop: 48 },
  modalTitle:         { fontSize: 24, fontWeight: "700", color: "#1a1a2e", marginBottom: 24 },
  label:              { fontSize: 13, fontWeight: "600", color: "#495057", marginBottom: 8 },
  input:              { backgroundColor: "#f8f9fa", borderRadius: 10, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "#dee2e6", fontSize: 15, color: "#1a1a2e" },
  pickerWrap:         { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#dee2e6", marginBottom: 16, overflow: "hidden" },
  picker:             { height: 50, color: "#1a1a2e" },
  saveBtn:            { backgroundColor: "#4361ee", borderRadius: 10, padding: 16, alignItems: "center", marginBottom: 12 },
  saveBtnText:        { color: "#fff", fontWeight: "700", fontSize: 16 },
  cancelBtn:          { borderRadius: 10, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#dee2e6" },
  cancelBtnText:      { color: "#6c757d", fontWeight: "600", fontSize: 15 },
});