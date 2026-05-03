import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, Modal, RefreshControl,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import * as Location from "expo-location";
import api from "../services/api";

export default function ManageClassesScreen() {
  const [classes, setClasses]       = useState([]);
  const [units, setUnits]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal]           = useState(false);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [saving, setSaving]         = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsCoords, setGpsCoords]   = useState(null);

  const load = useCallback(async () => {
    try {
      const [classRes, unitRes] = await Promise.all([
        api.get("/lecturer/classes"),
        api.get("/lecturer/units"),
      ]);
      setClasses(classRes.data.classes);
      setUnits(unitRes.data.units);
    } catch {
      Alert.alert("Error", "Could not load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); };

  // Units that don't have a class yet
  const availableUnits = units.filter(u => !u.class_exists);

  const openCreate = () => {
    setSelectedUnit("");
    setGpsCoords(null);
    setModal(true);
  };

  const captureGPS = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Location access is needed to set classroom venue");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setGpsCoords({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });
    } catch {
      Alert.alert("Error", "Could not get GPS location");
    } finally {
      setGpsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedUnit)
      return Alert.alert("Missing unit", "Please select a unit for this class");

    setSaving(true);
    try {
      await api.post("/lecturer/classes", {
        unitId:       selectedUnit,
        classroomLat: gpsCoords?.lat || null,
        classroomLng: gpsCoords?.lng || null,
      });
      setModal(false);
      load();
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Could not create class");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (cls) => {
    Alert.alert(
      "Delete Class",
      `Delete "${cls.unit_name}"? All attendance records will also be deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/lecturer/classes/${cls.id}`);
              load();
            } catch {
              Alert.alert("Error", "Could not delete class");
            }
          },
        },
      ]
    );
  };

  // Group existing classes by course → year
  const grouped = {};
  classes.forEach(cls => {
    const courseKey = cls.course_name || "My Classes";
    const yearKey   = `Year ${cls.year_of_study}`;
    if (!grouped[courseKey]) grouped[courseKey] = {};
    if (!grouped[courseKey][yearKey]) grouped[courseKey][yearKey] = [];
    grouped[courseKey][yearKey].push(cls);
  });

  // Group available units the same way for the picker label
  const unitLabel = (u) =>
    `${u.name} (${u.code}) — ${u.course_name}, Yr ${u.year_of_study} Sem ${u.semester}`;

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#4361ee" />;

  return (
    <View style={styles.container}>
      {/* Add button — only show if there are unassigned units */}
      {availableUnits.length > 0 ? (
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Text style={styles.addBtnText}>＋  Create New Class</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.allDoneBanner}>
          <Text style={styles.allDoneText}>
            ✅ You have created classes for all your assigned units
          </Text>
        </View>
      )}

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4361ee" />}
      >
        {classes.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No classes yet.</Text>
            <Text style={styles.emptyHint}>
              Tap "Create New Class" to set up a class for one of your assigned units.
            </Text>
          </View>
        )}

        {/* Grouped by course → year */}
        {Object.entries(grouped).map(([courseName, years]) => (
          <View key={courseName}>
            <View style={styles.courseHeader}>
              <Text style={styles.courseName}>📖 {courseName}</Text>
            </View>

            {Object.entries(years).map(([yearLabel, clsList]) => (
              <View key={yearLabel}>
                <Text style={styles.yearLabel}>{yearLabel}</Text>

                {clsList.map(cls => (
                  <View key={cls.id} style={styles.card}>
                    <View style={styles.cardTop}>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{cls.unit_code}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.className}>{cls.unit_name}</Text>
                        <Text style={styles.meta}>Semester {cls.semester}</Text>
                        {cls.classroom_lat ? (
                          <Text style={styles.coords}>
                            📍 {parseFloat(cls.classroom_lat).toFixed(4)}, {parseFloat(cls.classroom_lng).toFixed(4)}
                          </Text>
                        ) : (
                          <Text style={styles.coordsMissing}>📍 No reference venue set</Text>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(cls)}
                    >
                      <Text style={styles.deleteBtnText}>🗑 Delete Class</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}

        {/* Unassigned units section */}
        {availableUnits.length > 0 && (
          <View style={styles.unassignedSection}>
            <Text style={styles.unassignedTitle}>Units without a class yet</Text>
            {availableUnits.map(u => (
              <View key={u.id} style={styles.unassignedRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{u.code}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.unassignedName}>{u.name}</Text>
                  <Text style={styles.unassignedMeta}>
                    {u.course_name} · Yr {u.year_of_study} Sem {u.semester}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.quickCreateBtn}
                  onPress={() => {
                    setSelectedUnit(u.id);
                    setGpsCoords(null);
                    setModal(true);
                  }}
                >
                  <Text style={styles.quickCreateText}>＋ Create</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Create class modal */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <ScrollView contentContainerStyle={styles.modal}>
          <Text style={styles.modalTitle}>Create New Class</Text>
          <Text style={styles.modalSub}>
            Select one of your assigned units to create a class for it.
          </Text>

          {/* Unit picker */}
          <Text style={styles.label}>Unit</Text>
          {availableUnits.length === 0 ? (
            <Text style={styles.noUnits}>All your units already have classes.</Text>
          ) : (
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={selectedUnit}
                onValueChange={setSelectedUnit}
                style={styles.picker}
              >
                <Picker.Item label="Select a unit..." value="" />
                {availableUnits.map(u => (
                  <Picker.Item key={u.id} label={unitLabel(u)} value={u.id} />
                ))}
              </Picker>
            </View>
          )}

          {/* Optional reference GPS */}
          <Text style={styles.label}>Reference Venue (optional)</Text>
          <Text style={styles.venueHint}>
            This is a fixed reference point. The live GPS geofence is always captured when you open attendance.
          </Text>

          <TouchableOpacity style={styles.gpsBtn} onPress={captureGPS} disabled={gpsLoading}>
            {gpsLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.gpsBtnText}>📡 Use My Current Location</Text>
            }
          </TouchableOpacity>

          {gpsCoords && (
            <View style={styles.coordPreview}>
              <Text style={styles.coordPreviewText}>
                ✓ {gpsCoords.lat.toFixed(5)}, {gpsCoords.lng.toFixed(5)}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, !selectedUnit && styles.saveBtnDisabled]}
            onPress={handleCreate}
            disabled={saving || !selectedUnit}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>Create Class</Text>
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
  container:          { flex: 1, padding: 20, backgroundColor: "#f8f9fa" },
  addBtn:             { backgroundColor: "#4361ee", borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 16 },
  addBtnText:         { color: "#fff", fontWeight: "700", fontSize: 15 },
  allDoneBanner:      { backgroundColor: "#d8f3dc", borderRadius: 12, padding: 14, marginBottom: 16 },
  allDoneText:        { color: "#2d6a4f", fontWeight: "600", fontSize: 13, textAlign: "center" },
  courseHeader:       { backgroundColor: "#dbe4ff", borderRadius: 10, padding: 12, marginTop: 16, marginBottom: 8 },
  courseName:         { fontSize: 14, fontWeight: "700", color: "#3451b2" },
  yearLabel:          { fontSize: 12, fontWeight: "700", color: "#6c757d", marginBottom: 8, marginLeft: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  card:               { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#dee2e6" },
  cardTop:            { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  badge:              { backgroundColor: "#dbe4ff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText:          { color: "#3451b2", fontWeight: "700", fontSize: 12 },
  className:          { fontSize: 15, fontWeight: "600", color: "#1a1a2e" },
  meta:               { fontSize: 11, color: "#adb5bd", marginTop: 2 },
  coords:             { fontSize: 11, color: "#6c757d", marginTop: 4 },
  coordsMissing:      { fontSize: 11, color: "#adb5bd", marginTop: 4 },
  deleteBtn:          { backgroundColor: "#ffe0e0", borderRadius: 8, padding: 10, alignItems: "center" },
  deleteBtnText:      { fontSize: 13, fontWeight: "600", color: "#c0392b" },
  unassignedSection:  { marginTop: 24 },
  unassignedTitle:    { fontSize: 13, fontWeight: "700", color: "#6c757d", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  unassignedRow:      { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#dee2e6" },
  unassignedName:     { fontSize: 14, fontWeight: "600", color: "#1a1a2e" },
  unassignedMeta:     { fontSize: 11, color: "#adb5bd", marginTop: 2 },
  quickCreateBtn:     { backgroundColor: "#4361ee", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  quickCreateText:    { color: "#fff", fontWeight: "700", fontSize: 12 },
  empty:              { alignItems: "center", marginTop: 60 },
  emptyText:          { fontSize: 16, color: "#adb5bd", fontWeight: "600" },
  emptyHint:          { fontSize: 13, color: "#adb5bd", marginTop: 6, textAlign: "center" },
  modal:              { padding: 28, paddingTop: 48 },
  modalTitle:         { fontSize: 24, fontWeight: "700", color: "#1a1a2e", marginBottom: 8 },
  modalSub:           { fontSize: 14, color: "#6c757d", marginBottom: 24 },
  label:              { fontSize: 13, fontWeight: "600", color: "#495057", marginBottom: 8 },
  pickerWrap:         { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#dee2e6", marginBottom: 20, overflow: "hidden" },
  picker:             { height: 50, color: "#1a1a2e" },
  noUnits:            { fontSize: 14, color: "#adb5bd", marginBottom: 20 },
  venueHint:          { fontSize: 12, color: "#adb5bd", marginBottom: 12 },
  gpsBtn:             { backgroundColor: "#2d6a4f", borderRadius: 10, padding: 14, alignItems: "center", marginBottom: 12 },
  gpsBtnText:         { color: "#fff", fontWeight: "700", fontSize: 14 },
  coordPreview:       { backgroundColor: "#d8f3dc", borderRadius: 8, padding: 10, marginBottom: 16 },
  coordPreviewText:   { color: "#2d6a4f", fontSize: 13, fontWeight: "600" },
  saveBtn:            { backgroundColor: "#4361ee", borderRadius: 10, padding: 16, alignItems: "center", marginBottom: 12 },
  saveBtnDisabled:    { backgroundColor: "#adb5bd" },
  saveBtnText:        { color: "#fff", fontWeight: "700", fontSize: 16 },
  cancelBtn:          { borderRadius: 10, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#dee2e6" },
  cancelBtnText:      { color: "#6c757d", fontWeight: "600", fontSize: 15 },
});