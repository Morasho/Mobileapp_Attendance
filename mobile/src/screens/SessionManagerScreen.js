import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert, RefreshControl,
  Modal, TextInput, Switch,
} from "react-native";
import * as Location from "expo-location";
import api from "../services/api";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SessionManagerScreen({ navigation }) {
  const [classes, setClasses]             = useState([]);
  const [sessions, setSessions]           = useState({});
  const [nextDates, setNextDates]         = useState({});
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [activePeriod, setActivePeriod]   = useState(null);

  // Makeup modal state
  const [makeupModal, setMakeupModal]     = useState(false);
  const [pendingClass, setPendingClass]   = useState(null);
  const [isMakeup, setIsMakeup]           = useState(false);
  const [makeupReason, setMakeupReason]   = useState("");
  const [customNextDate, setCustomNextDate] = useState("");

  const load = useCallback(async () => {
    try {
      const [classRes, sessionRes] = await Promise.all([
        api.get("/lecturer/classes"),
        api.get("/sessions/my-open"),
      ]);
      const classList = classRes.data.classes;
      setClasses(classList);

      const openMap = {};
      sessionRes.data.sessions.forEach(s => { openMap[s.class_id] = s; });
      setSessions(openMap);

      // Fetch next class date for each class
      const dateMap = {};
      await Promise.all(
        classList.map(async cls => {
          try {
            const { data } = await api.get(`/lecturer/classes/${cls.id}/next-class`);
            dateMap[cls.id] = data;
          } catch (_) {}
        })
      );
      setNextDates(dateMap);

      // Check active period
      try {
        const { data } = await api.get("/periods/active");
        setActivePeriod(data.period || null);
      } catch (_) {}

    } catch {
      Alert.alert("Error", "Could not load classes");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); };

  const promptOpenSession = (cls) => {
    setPendingClass(cls);
    setIsMakeup(false);
    setMakeupReason("");
    setCustomNextDate(nextDates[cls.id]?.nextDate || "");
    setMakeupModal(true);
  };

  const confirmOpenSession = async () => {
    setMakeupModal(false);
    await doOpenSession(pendingClass, isMakeup, makeupReason, customNextDate);
  };

  const doOpenSession = async (cls, makeup, reason, nextDate) => {
    setActionLoading(cls.id);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location required", "GPS permission is needed to set the attendance geofence.");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });

      const { data } = await api.post("/sessions/open", {
        classId:       cls.id,
        lat:           loc.coords.latitude,
        lng:           loc.coords.longitude,
        isMakeup:      makeup,
        makeupReason:  reason || undefined,
        nextClassDate: nextDate || undefined,
      });

      const nextMsg = data.session.next_class_date
        ? `\nNext class: ${data.session.next_class_date}`
        : "";

      const makeupMsg = makeup ? "\n📌 Marked as make-up class" : "";

      Alert.alert(
        "Session Opened",
        `Attendance is now live for ${cls.unit_name}.${makeupMsg}${nextMsg}`
      );

      if (data.periodWarning)
        setTimeout(() => Alert.alert("⚠️ No active period", data.periodWarning), 500);

      setSessions(prev => ({ ...prev, [cls.id]: data.session }));
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Could not open session");
    } finally {
      setActionLoading(null);
    }
  };

  const closeSession = async (cls) => {
    setActionLoading(cls.id);
    try {
      const { data } = await api.post("/sessions/close", { classId: cls.id });
      const nextMsg = data.nextClassDate
        ? `\nNext class: ${data.nextClassDate}`
        : "";
      Alert.alert(
        "Session Closed",
        `Attendance closed for ${cls.unit_name}.\n${data.totalSignIns} student(s) signed in.${nextMsg}`
      );
      setSessions(prev => { const n = { ...prev }; delete n[cls.id]; return n; });
      load();
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Could not close session");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#4361ee" />;

  const openCount = Object.keys(sessions).length;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4361ee" />}
      >
        {/* Period banner */}
        {activePeriod ? (
          <View style={styles.periodBanner}>
            <Text style={styles.periodText}>📅 {activePeriod.name}</Text>
          </View>
        ) : (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>⚠️ No active semester — ask admin to set one</Text>
          </View>
        )}

        {/* Session status banner */}
        <View style={[styles.banner, openCount > 0 ? styles.bannerActive : styles.bannerIdle]}>
          <Text style={styles.bannerTitle}>
            {openCount > 0 ? `${openCount} session${openCount > 1 ? "s" : ""} open` : "No open sessions"}
          </Text>
          <Text style={styles.bannerSub}>
            {openCount > 0 ? "Students can currently sign in" : "Tap a class to open attendance"}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Your Classes</Text>

        {classes.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No classes yet.</Text>
            <Text style={styles.emptyHint}>Create a class in Manage Classes first.</Text>
          </View>
        )}

        {classes.map(cls => {
          const isOpen    = !!sessions[cls.id];
          const session   = sessions[cls.id];
          const isLoading = actionLoading === cls.id;
          const nd        = nextDates[cls.id];

          return (
            <View key={cls.id} style={[styles.card, isOpen && styles.cardOpen]}>
              <View style={styles.cardTop}>
                <View style={[styles.badge, isOpen && styles.badgeOpen]}>
                  <Text style={[styles.badgeText, isOpen && styles.badgeTextOpen]}>
                    {cls.unit_code}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.className}>{cls.unit_name}</Text>
                  <Text style={styles.meta}>Year {cls.year_of_study} · Sem {cls.semester}</Text>
                  <Text style={[styles.statusText, isOpen ? styles.statusOpen : styles.statusClosed]}>
                    {isOpen ? "🟢 Attendance open" : "🔴 Attendance closed"}
                  </Text>
                  {isOpen && session?.is_makeup && (
                    <Text style={styles.makeupTag}>📌 Make-up class</Text>
                  )}
                  {isOpen && session?.next_class_date && (
                    <Text style={styles.nextDate}>📅 Next: {session.next_class_date}</Text>
                  )}
                  {!isOpen && nd?.nextDate && (
                    <Text style={styles.nextDateIdle}>📅 Scheduled: {nd.nextDate}</Text>
                  )}
                  {!isOpen && nd?.slots?.length > 0 && (
                    <Text style={styles.schedule}>
                      🕐 {nd.slots.map(s => `${DAY_NAMES[s.day_of_week]} ${s.start_time}`).join(", ")}
                    </Text>
                  )}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.toggleBtn, isOpen ? styles.closeBtn : styles.openBtn]}
                onPress={() => isOpen ? closeSession(cls) : promptOpenSession(cls)}
                disabled={isLoading}
              >
                {isLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.toggleBtnText}>
                      {isOpen ? "Close Attendance" : "Open Attendance (GPS)"}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      {/* Open session modal — makeup + next date */}
      <Modal visible={makeupModal} animationType="slide" presentationStyle="pageSheet">
        <ScrollView contentContainerStyle={styles.modal}>
          <Text style={styles.modalTitle}>
            Open: {pendingClass?.unit_name}
          </Text>
          <Text style={styles.modalSub}>
            Your current GPS location will be used as the attendance geofence.
          </Text>

          {/* Make-up toggle */}
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Make-up class?</Text>
              <Text style={styles.switchHint}>Toggle if this is a replacement or extra class</Text>
            </View>
            <Switch
              value={isMakeup}
              onValueChange={setIsMakeup}
              trackColor={{ true: "#4361ee" }}
            />
          </View>

          {isMakeup && (
            <TextInput
              style={styles.input}
              placeholder="Reason for make-up (optional)"
              placeholderTextColor="#adb5bd"
              value={makeupReason}
              onChangeText={setMakeupReason}
              multiline
            />
          )}

          {/* Next class date */}
          <Text style={styles.label}>Next class date</Text>
          <Text style={styles.venueHint}>
            Auto-suggested from your schedule. Edit if different.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#adb5bd"
            value={customNextDate}
            onChangeText={setCustomNextDate}
          />

          <TouchableOpacity style={styles.saveBtn} onPress={confirmOpenSession}>
            <Text style={styles.saveBtnText}>Open Attendance</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setMakeupModal(false)}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flexGrow: 1, padding: 20, backgroundColor: "#f8f9fa" },
  periodBanner:   { backgroundColor: "#dbe4ff", borderRadius: 10, padding: 10, marginBottom: 10 },
  periodText:     { color: "#3451b2", fontWeight: "600", fontSize: 13 },
  warningBanner:  { backgroundColor: "#fff3bf", borderRadius: 10, padding: 10, marginBottom: 10 },
  warningText:    { color: "#856404", fontWeight: "600", fontSize: 13 },
  banner:         { borderRadius: 14, padding: 18, marginBottom: 20 },
  bannerActive:   { backgroundColor: "#d8f3dc" },
  bannerIdle:     { backgroundColor: "#f1f3f5" },
  bannerTitle:    { fontSize: 17, fontWeight: "700", color: "#1a1a2e" },
  bannerSub:      { fontSize: 13, color: "#6c757d", marginTop: 4 },
  sectionTitle:   { fontSize: 15, fontWeight: "700", color: "#1a1a2e", marginBottom: 12 },
  card:           { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: "#dee2e6" },
  cardOpen:       { borderColor: "#2d6a4f", backgroundColor: "#f0fdf4" },
  cardTop:        { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  badge:          { backgroundColor: "#dbe4ff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  badgeOpen:      { backgroundColor: "#d8f3dc" },
  badgeText:      { color: "#3451b2", fontWeight: "700", fontSize: 12 },
  badgeTextOpen:  { color: "#2d6a4f" },
  className:      { fontSize: 15, fontWeight: "600", color: "#1a1a2e" },
  meta:           { fontSize: 11, color: "#adb5bd", marginTop: 2 },
  statusText:     { fontSize: 12, marginTop: 4, fontWeight: "500" },
  statusOpen:     { color: "#2d6a4f" },
  statusClosed:   { color: "#c0392b" },
  makeupTag:      { fontSize: 11, color: "#856404", marginTop: 3 },
  nextDate:       { fontSize: 11, color: "#2d6a4f", marginTop: 3, fontWeight: "600" },
  nextDateIdle:   { fontSize: 11, color: "#4361ee", marginTop: 3 },
  schedule:       { fontSize: 11, color: "#6c757d", marginTop: 2 },
  toggleBtn:      { borderRadius: 10, padding: 13, alignItems: "center" },
  openBtn:        { backgroundColor: "#4361ee" },
  closeBtn:       { backgroundColor: "#e63946" },
  toggleBtnText:  { color: "#fff", fontWeight: "700", fontSize: 14 },
  empty:          { alignItems: "center", marginTop: 40 },
  emptyText:      { fontSize: 16, color: "#adb5bd", fontWeight: "600" },
  emptyHint:      { fontSize: 13, color: "#adb5bd", marginTop: 6 },
  modal:          { padding: 28, paddingTop: 48 },
  modalTitle:     { fontSize: 22, fontWeight: "700", color: "#1a1a2e", marginBottom: 6 },
  modalSub:       { fontSize: 13, color: "#6c757d", marginBottom: 24 },
  switchRow:      { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#dee2e6" },
  switchLabel:    { fontSize: 15, fontWeight: "600", color: "#1a1a2e" },
  switchHint:     { fontSize: 12, color: "#6c757d", marginTop: 2 },
  label:          { fontSize: 13, fontWeight: "600", color: "#495057", marginBottom: 6 },
  venueHint:      { fontSize: 12, color: "#adb5bd", marginBottom: 10 },
  input:          { backgroundColor: "#f8f9fa", borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#dee2e6", fontSize: 15, color: "#1a1a2e" },
  saveBtn:        { backgroundColor: "#4361ee", borderRadius: 10, padding: 16, alignItems: "center", marginBottom: 12 },
  saveBtnText:    { color: "#fff", fontWeight: "700", fontSize: 16 },
  cancelBtn:      { borderRadius: 10, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#dee2e6" },
  cancelBtnText:  { color: "#6c757d", fontWeight: "600", fontSize: 15 },
});