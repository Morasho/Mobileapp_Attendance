import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, Modal, RefreshControl,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import * as Location from "expo-location";
import api from "../services/api";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TIME_OPTIONS = [];
for (let h = 6; h <= 20; h++) {
  ["00", "30"].forEach(m => {
    const label = `${h.toString().padStart(2, "0")}:${m}`;
    TIME_OPTIONS.push(label);
  });
}

export default function ManageClassesScreen() {
  const [classes, setClasses]       = useState([]);
  const [units, setUnits]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create class modal
  const [createModal, setCreateModal] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [saving, setSaving]           = useState(false);
  const [gpsLoading, setGpsLoading]   = useState(false);
  const [gpsCoords, setGpsCoords]     = useState(null);

  // Schedule modal
  const [scheduleModal, setScheduleModal]   = useState(false);
  const [scheduleClass, setScheduleClass]   = useState(null);
  const [schedule, setSchedule]             = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [newDay, setNewDay]                 = useState("1");
  const [newStart, setNewStart]             = useState("08:00");
  const [newEnd, setNewEnd]                 = useState("10:00");
  const [addingSlot, setAddingSlot]         = useState(false);

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

  const availableUnits = units.filter(u => !u.class_exists);

  // ── Create class ───────────────────────────────────────────
  const captureGPS = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Location access is needed");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setGpsCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {
      Alert.alert("Error", "Could not get GPS location");
    } finally {
      setGpsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedUnit)
      return Alert.alert("Missing unit", "Please select a unit");
    setSaving(true);
    try {
      await api.post("/lecturer/classes", {
        unitId:       selectedUnit,
        classroomLat: gpsCoords?.lat || null,
        classroomLng: gpsCoords?.lng || null,
      });
      setCreateModal(false);
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

  // ── Schedule ───────────────────────────────────────────────
  const openSchedule = async (cls) => {
    setScheduleClass(cls);
    setScheduleModal(true);
    setScheduleLoading(true);
    try {
      const { data } = await api.get(`/lecturer/classes/${cls.id}/schedule`);
      setSchedule(data.schedule || []);
    } catch {
      Alert.alert("Error", "Could not load schedule");
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleAddSlot = async () => {
    if (!newDay && newDay !== "0")
      return Alert.alert("Missing", "Please select a day");
    if (newStart >= newEnd)
      return Alert.alert("Invalid time", "End time must be after start time");

    // Check for duplicate day
    if (schedule.find(s => String(s.day_of_week) === String(newDay))) {
      return Alert.alert(
        "Duplicate day",
        `You already have a slot on ${DAY_NAMES[newDay]}. Delete it first to change the time.`
      );
    }

    setAddingSlot(true);
    try {
      const { data } = await api.post(`/lecturer/classes/${scheduleClass.id}/schedule`, {
        dayOfWeek: parseInt(newDay),
        startTime: newStart,
        endTime:   newEnd,
      });
      setSchedule(prev => [...prev, data.schedule].sort((a, b) => a.day_of_week - b.day_of_week));
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Could not add slot");
    } finally {
      setAddingSlot(false);
    }
  };

  const handleDeleteSlot = (slot) => {
    Alert.alert(
      "Remove slot",
      `Remove ${DAY_NAMES[slot.day_of_week]} ${slot.start_time}–${slot.end_time}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove", style: "destructive",
          onPress: async () => {
            try {
              await api.delete(
                `/lecturer/classes/${scheduleClass.id}/schedule/${slot.id}`
              );
              setSchedule(prev => prev.filter(s => s.id !== slot.id));
            } catch {
              Alert.alert("Error", "Could not remove slot");
            }
          },
        },
      ]
    );
  };

  // ── Grouping ───────────────────────────────────────────────
  const grouped = {};
  classes.forEach(cls => {
    const courseKey = cls.course_name || "My Classes";
    const yearKey   = `Year ${cls.year_of_study}`;
    if (!grouped[courseKey]) grouped[courseKey] = {};
    if (!grouped[courseKey][yearKey]) grouped[courseKey][yearKey] = [];
    grouped[courseKey][yearKey].push(cls);
  });

  const unitLabel = (u) =>
    `${u.name} (${u.code}) — ${u.course_name}, Yr ${u.year_of_study} Sem ${u.semester}`;

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#4361ee" />;

  return (
    <View style={styles.container}>
      {availableUnits.length > 0 ? (
        <TouchableOpacity style={styles.addBtn} onPress={() => {
          setSelectedUnit(""); setGpsCoords(null); setCreateModal(true);
        }}>
          <Text style={styles.addBtnText}>＋  Create New Class</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.allDoneBanner}>
          <Text style={styles.allDoneText}>✅ Classes created for all assigned units</Text>
        </View>
      )}

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4361ee" />}>
        {classes.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No classes yet.</Text>
            <Text style={styles.emptyHint}>Tap "Create New Class" to get started.</Text>
          </View>
        )}

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

                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.scheduleBtn}
                        onPress={() => openSchedule(cls)}
                      >
                        <Text style={styles.scheduleBtnText}>🗓 Set Schedule</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDelete(cls)}
                      >
                        <Text style={styles.deleteBtnText}>🗑 Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}

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
                  onPress={() => { setSelectedUnit(u.id); setGpsCoords(null); setCreateModal(true); }}
                >
                  <Text style={styles.quickCreateText}>＋ Create</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Create class modal ─────────────────────────────── */}
      <Modal visible={createModal} animationType="slide" presentationStyle="pageSheet">
        <ScrollView contentContainerStyle={styles.modal}>
          <Text style={styles.modalTitle}>Create New Class</Text>
          <Text style={styles.modalSub}>Select a unit to create a class for it.</Text>

          <Text style={styles.label}>Unit</Text>
          {availableUnits.length === 0 ? (
            <Text style={styles.noUnits}>All your units already have classes.</Text>
          ) : (
            <View style={styles.pickerWrap}>
              <Picker selectedValue={selectedUnit} onValueChange={setSelectedUnit} style={styles.picker}>
                <Picker.Item label="Select a unit..." value="" />
                {availableUnits.map(u => (
                  <Picker.Item key={u.id} label={unitLabel(u)} value={u.id} />
                ))}
              </Picker>
            </View>
          )}

          <Text style={styles.label}>Reference Venue (optional)</Text>
          <Text style={styles.venueHint}>
            Fixed reference point. Live GPS geofence is captured when you open attendance.
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
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Create Class</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateModal(false)}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>

      {/* ── Schedule modal ─────────────────────────────────── */}
      <Modal visible={scheduleModal} animationType="slide" presentationStyle="pageSheet">
        <ScrollView contentContainerStyle={styles.modal}>
          <Text style={styles.modalTitle}>
            {scheduleClass?.unit_name} Schedule
          </Text>
          <Text style={styles.modalSub}>
            Set the weekly recurring timetable for this class.
          </Text>

          {scheduleLoading ? (
            <ActivityIndicator color="#4361ee" style={{ marginVertical: 20 }} />
          ) : (
            <>
              {/* Existing slots */}
              {schedule.length === 0 ? (
                <View style={styles.noSchedule}>
                  <Text style={styles.noScheduleText}>No schedule set yet.</Text>
                  <Text style={styles.noScheduleHint}>Add slots below.</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.label}>Current schedule</Text>
                  {schedule.map(slot => (
                    <View key={slot.id} style={styles.slotRow}>
                      <View style={styles.slotDayBadge}>
                        <Text style={styles.slotDayText}>{DAY_SHORT[slot.day_of_week]}</Text>
                      </View>
                      <Text style={styles.slotTime}>
                        {slot.start_time} – {slot.end_time}
                      </Text>
                      <TouchableOpacity
                        style={styles.slotDeleteBtn}
                        onPress={() => handleDeleteSlot(slot)}
                      >
                        <Text style={styles.slotDeleteText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}

              {/* Add new slot */}
              <View style={styles.divider} />
              <Text style={styles.label}>Add a time slot</Text>

              <Text style={styles.subLabel}>Day of week</Text>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={newDay} onValueChange={setNewDay} style={styles.picker}>
                  {DAY_NAMES.map((d, i) => (
                    <Picker.Item key={i} label={d} value={String(i)} />
                  ))}
                </Picker>
              </View>

              <View style={styles.timeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subLabel}>Start time</Text>
                  <View style={styles.pickerWrap}>
                    <Picker selectedValue={newStart} onValueChange={setNewStart} style={styles.picker}>
                      {TIME_OPTIONS.map(t => (
                        <Picker.Item key={t} label={t} value={t} />
                      ))}
                    </Picker>
                  </View>
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.subLabel}>End time</Text>
                  <View style={styles.pickerWrap}>
                    <Picker selectedValue={newEnd} onValueChange={setNewEnd} style={styles.picker}>
                      {TIME_OPTIONS.map(t => (
                        <Picker.Item key={t} label={t} value={t} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>

              <TouchableOpacity style={styles.addSlotBtn} onPress={handleAddSlot} disabled={addingSlot}>
                {addingSlot
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.addSlotBtnText}>＋ Add Slot</Text>
                }
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={() => setScheduleModal(false)}>
            <Text style={styles.cancelBtnText}>Done</Text>
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
  cardTop:            { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  badge:              { backgroundColor: "#dbe4ff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText:          { color: "#3451b2", fontWeight: "700", fontSize: 12 },
  className:          { fontSize: 15, fontWeight: "600", color: "#1a1a2e" },
  meta:               { fontSize: 11, color: "#adb5bd", marginTop: 2 },
  coords:             { fontSize: 11, color: "#6c757d", marginTop: 4 },
  coordsMissing:      { fontSize: 11, color: "#adb5bd", marginTop: 4 },
  cardActions:        { flexDirection: "row", gap: 8 },
  scheduleBtn:        { flex: 1, backgroundColor: "#dbe4ff", borderRadius: 8, padding: 10, alignItems: "center" },
  scheduleBtnText:    { color: "#3451b2", fontWeight: "700", fontSize: 13 },
  deleteBtn:          { flex: 1, backgroundColor: "#ffe0e0", borderRadius: 8, padding: 10, alignItems: "center" },
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
  modalTitle:         { fontSize: 22, fontWeight: "700", color: "#1a1a2e", marginBottom: 8 },
  modalSub:           { fontSize: 14, color: "#6c757d", marginBottom: 24 },
  label:              { fontSize: 13, fontWeight: "600", color: "#495057", marginBottom: 8 },
  subLabel:           { fontSize: 12, color: "#6c757d", marginBottom: 6 },
  pickerWrap:         { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#dee2e6", marginBottom: 14, overflow: "hidden" },
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
  cancelBtn:          { borderRadius: 10, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#dee2e6", marginTop: 8 },
  cancelBtnText:      { color: "#6c757d", fontWeight: "600", fontSize: 15 },
  noSchedule:         { alignItems: "center", paddingVertical: 20 },
  noScheduleText:     { fontSize: 15, color: "#adb5bd", fontWeight: "600" },
  noScheduleHint:     { fontSize: 13, color: "#adb5bd", marginTop: 4 },
  slotRow:            { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#f8f9fa", borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#dee2e6" },
  slotDayBadge:       { backgroundColor: "#4361ee", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 44, alignItems: "center" },
  slotDayText:        { color: "#fff", fontWeight: "700", fontSize: 12 },
  slotTime:           { flex: 1, fontSize: 14, fontWeight: "600", color: "#1a1a2e" },
  slotDeleteBtn:      { backgroundColor: "#ffe0e0", borderRadius: 6, width: 28, height: 28, justifyContent: "center", alignItems: "center" },
  slotDeleteText:     { color: "#c0392b", fontWeight: "700", fontSize: 13 },
  divider:            { height: 1, backgroundColor: "#dee2e6", marginVertical: 20 },
  timeRow:            { flexDirection: "row" },
  addSlotBtn:         { backgroundColor: "#2d6a4f", borderRadius: 10, padding: 14, alignItems: "center", marginBottom: 12 },
  addSlotBtnText:     { color: "#fff", fontWeight: "700", fontSize: 14 },
});