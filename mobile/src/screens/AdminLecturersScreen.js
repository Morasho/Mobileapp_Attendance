import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, Modal, RefreshControl,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import api from "../services/api";

export default function AdminLecturersScreen() {
  const [lecturers, setLecturers] = useState([]);
  const [units, setUnits]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal]         = useState(false);
  const [selectedLecturer, setSelectedLecturer] = useState("");
  const [selectedUnit, setSelectedUnit]         = useState("");
  const [saving, setSaving]       = useState(false);
  const [assignments, setAssignments] = useState({}); // lecturerId → [unit ids]

  const load = useCallback(async () => {
    try {
      const [lecRes, unitRes] = await Promise.all([
        api.get("/admin/lecturers"),
        api.get("/admin/units"),
      ]);
      setLecturers(lecRes.data.lecturers || []);
      setUnits(unitRes.data.units || []);

      // Build assignment map from each lecturer's units
      const map = {};
      for (const lec of (lecRes.data.lecturers || [])) {
        map[lec.id] = lec.units || [];
      }
      setAssignments(map);
    } catch {
      Alert.alert("Error", "Could not load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); };

  const handleAssign = async () => {
    if (!selectedLecturer || !selectedUnit)
      return Alert.alert("Missing selection", "Please select both a lecturer and a unit");
    setSaving(true);
    try {
      await api.post("/admin/lecturer-units", {
        lecturerId: selectedLecturer,
        unitId:     selectedUnit,
      });
      setModal(false);
      load();
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Could not assign unit");
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = (lecturerId, unitId, unitName) => {
    Alert.alert(
      "Remove Assignment",
      `Remove this lecturer from "${unitName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove", style: "destructive",
          onPress: async () => {
            try {
              await api.delete("/admin/lecturer-units", {
                data: { lecturerId, unitId },
              });
              load();
            } catch {
              Alert.alert("Error", "Could not remove assignment");
            }
          },
        },
      ]
    );
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#4361ee" />;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addBtn} onPress={() => {
        setSelectedLecturer("");
        setSelectedUnit("");
        setModal(true);
      }}>
        <Text style={styles.addBtnText}>＋  Assign Unit to Lecturer</Text>
      </TouchableOpacity>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4361ee" />}>
        {lecturers.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No lecturers registered yet.</Text>
          </View>
        )}

        {lecturers.map(lec => (
          <View key={lec.id} style={styles.card}>
            {/* Lecturer header */}
            <View style={styles.lecturerHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{lec.name[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lecturerName}>{lec.name}</Text>
                <Text style={styles.lecturerEmail}>{lec.email}</Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>
                  {(assignments[lec.id] || []).length} unit(s)
                </Text>
              </View>
            </View>

            {/* Assigned units */}
            {(assignments[lec.id] || []).length === 0 ? (
              <Text style={styles.noUnits}>No units assigned yet</Text>
            ) : (
              (assignments[lec.id] || []).map(u => (
                <View key={u.id} style={styles.unitRow}>
                  <View style={styles.unitBadge}>
                    <Text style={styles.unitCode}>{u.code}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.unitName}>{u.name}</Text>
                    <Text style={styles.unitMeta}>
                      {u.course_name} · Yr {u.year_of_study} Sem {u.semester}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => handleUnassign(lec.id, u.id, u.name)}
                  >
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        ))}
      </ScrollView>

      {/* Assign modal */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <ScrollView contentContainerStyle={styles.modal}>
          <Text style={styles.modalTitle}>Assign Unit to Lecturer</Text>

          <Text style={styles.label}>Lecturer</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={selectedLecturer} onValueChange={setSelectedLecturer} style={styles.picker}>
              <Picker.Item label="Select lecturer..." value="" />
              {lecturers.map(l => <Picker.Item key={l.id} label={l.name} value={l.id} />)}
            </Picker>
          </View>

          <Text style={styles.label}>Unit</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={selectedUnit} onValueChange={setSelectedUnit} style={styles.picker}>
              <Picker.Item label="Select unit..." value="" />
              {units.map(u => (
                <Picker.Item
                  key={u.id}
                  label={`${u.name} (${u.code}) — Yr ${u.year_of_study} Sem ${u.semester}`}
                  value={u.id}
                />
              ))}
            </Picker>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleAssign} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Assign</Text>}
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
  container:      { flex: 1, padding: 20, backgroundColor: "#f8f9fa" },
  addBtn:         { backgroundColor: "#4361ee", borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 16 },
  addBtnText:     { color: "#fff", fontWeight: "700", fontSize: 15 },
  card:           { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#dee2e6" },
  lecturerHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  avatar:         { width: 40, height: 40, borderRadius: 20, backgroundColor: "#dbe4ff", justifyContent: "center", alignItems: "center" },
  avatarText:     { fontSize: 16, fontWeight: "700", color: "#3451b2" },
  lecturerName:   { fontSize: 15, fontWeight: "600", color: "#1a1a2e" },
  lecturerEmail:  { fontSize: 12, color: "#6c757d", marginTop: 2 },
  countBadge:     { backgroundColor: "#f1f3f5", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  countText:      { fontSize: 12, color: "#495057", fontWeight: "600" },
  noUnits:        { fontSize: 13, color: "#adb5bd", fontStyle: "italic", paddingLeft: 4 },
  unitRow:        { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#f1f3f5" },
  unitBadge:      { backgroundColor: "#dbe4ff", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  unitCode:       { color: "#3451b2", fontWeight: "700", fontSize: 11 },
  unitName:       { fontSize: 13, fontWeight: "600", color: "#1a1a2e" },
  unitMeta:       { fontSize: 11, color: "#adb5bd", marginTop: 1 },
  removeBtn:      { backgroundColor: "#ffe0e0", borderRadius: 6, width: 28, height: 28, justifyContent: "center", alignItems: "center" },
  removeBtnText:  { color: "#c0392b", fontWeight: "700", fontSize: 13 },
  empty:          { alignItems: "center", marginTop: 60 },
  emptyText:      { fontSize: 16, color: "#adb5bd", fontWeight: "600" },
  modal:          { padding: 28, paddingTop: 48 },
  modalTitle:     { fontSize: 24, fontWeight: "700", color: "#1a1a2e", marginBottom: 24 },
  label:          { fontSize: 13, fontWeight: "600", color: "#495057", marginBottom: 8 },
  pickerWrap:     { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#dee2e6", marginBottom: 16, overflow: "hidden" },
  picker:         { height: 50, color: "#1a1a2e" },
  saveBtn:        { backgroundColor: "#4361ee", borderRadius: 10, padding: 16, alignItems: "center", marginBottom: 12 },
  saveBtnText:    { color: "#fff", fontWeight: "700", fontSize: 16 },
  cancelBtn:      { borderRadius: 10, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#dee2e6" },
  cancelBtnText:  { color: "#6c757d", fontWeight: "600", fontSize: 15 },
});