import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert, RefreshControl,
} from "react-native";
import api from "../services/api";

export default function SessionManagerScreen({ navigation }) {
  const [classes, setClasses]         = useState([]);
  const [sessions, setSessions]       = useState({});
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const load = useCallback(async () => {
    try {
      const [classRes, sessionRes] = await Promise.all([
        api.get("/lecturer/classes"),
        api.get("/sessions/my-open"),
      ]);
      setClasses(classRes.data.classes);
      const openMap = {};
      sessionRes.data.sessions.forEach(s => { openMap[s.class_id] = true; });
      setSessions(openMap);
    } catch {
      Alert.alert("Error", "Could not load classes");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  const toggleSession = async (cls) => {
    const isOpen = sessions[cls.id];
    setActionLoading(cls.id);
    try {
      if (isOpen) {
        const { data } = await api.post("/sessions/close", { classId: cls.id });
        Alert.alert("Session Closed",
          `Attendance closed for ${cls.name}.\n${data.totalSignIns} student(s) signed in.`);
        setSessions(prev => ({ ...prev, [cls.id]: false }));
      } else {
        await api.post("/sessions/open", { classId: cls.id });
        Alert.alert("Session Opened",
          `Attendance is now live for ${cls.name}. Students can sign in.`);
        setSessions(prev => ({ ...prev, [cls.id]: true }));
      }
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Could not toggle session");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#4361ee" />;

  const openCount = Object.values(sessions).filter(Boolean).length;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4361ee" />}
    >
      <View style={[styles.banner, openCount > 0 ? styles.bannerActive : styles.bannerIdle]}>
        <Text style={styles.bannerTitle}>
          {openCount > 0
            ? `${openCount} session${openCount > 1 ? "s" : ""} open`
            : "No open sessions"}
        </Text>
        <Text style={styles.bannerSub}>
          {openCount > 0
            ? "Students can currently sign in to these classes"
            : "Tap a class below to open attendance"}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Your Classes</Text>

      {classes.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No classes yet.</Text>
          <Text style={styles.emptyHint}>Create a class in Manage Classes first.</Text>
        </View>
      )}

      {classes.map((cls) => {
        const isOpen    = !!sessions[cls.id];
        const isLoading = actionLoading === cls.id;
        return (
          <View key={cls.id} style={[styles.card, isOpen && styles.cardOpen]}>
            <View style={styles.cardTop}>
              <View style={[styles.badge, isOpen && styles.badgeOpen]}>
                <Text style={[styles.badgeText, isOpen && styles.badgeTextOpen]}>
                  {cls.course_code}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.className}>{cls.name}</Text>
                <Text style={[styles.statusText, isOpen ? styles.statusOpen : styles.statusClosed]}>
                  {isOpen ? "🟢 Attendance open" : "🔴 Attendance closed"}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.toggleBtn, isOpen ? styles.closeBtn : styles.openBtn]}
              onPress={() => toggleSession(cls)}
              disabled={isLoading}
            >
              {isLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.toggleBtnText}>
                    {isOpen ? "Close Attendance" : "Open Attendance"}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:     { flexGrow: 1, padding: 20, backgroundColor: "#f8f9fa" },
  banner:        { borderRadius: 14, padding: 18, marginBottom: 24 },
  bannerActive:  { backgroundColor: "#d8f3dc" },
  bannerIdle:    { backgroundColor: "#f1f3f5" },
  bannerTitle:   { fontSize: 17, fontWeight: "700", color: "#1a1a2e" },
  bannerSub:     { fontSize: 13, color: "#6c757d", marginTop: 4 },
  sectionTitle:  { fontSize: 15, fontWeight: "700", color: "#1a1a2e", marginBottom: 12 },
  card:          { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: "#dee2e6" },
  cardOpen:      { borderColor: "#2d6a4f", backgroundColor: "#f0fdf4" },
  cardTop:       { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  badge:         { backgroundColor: "#dbe4ff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  badgeOpen:     { backgroundColor: "#d8f3dc" },
  badgeText:     { color: "#3451b2", fontWeight: "700", fontSize: 12 },
  badgeTextOpen: { color: "#2d6a4f" },
  className:     { fontSize: 15, fontWeight: "600", color: "#1a1a2e" },
  statusText:    { fontSize: 12, marginTop: 3, fontWeight: "500" },
  statusOpen:    { color: "#2d6a4f" },
  statusClosed:  { color: "#c0392b" },
  toggleBtn:     { borderRadius: 10, padding: 13, alignItems: "center" },
  openBtn:       { backgroundColor: "#4361ee" },
  closeBtn:      { backgroundColor: "#e63946" },
  toggleBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  empty:         { alignItems: "center", marginTop: 40 },
  emptyText:     { fontSize: 16, color: "#adb5bd", fontWeight: "600" },
  emptyHint:     { fontSize: 13, color: "#adb5bd", marginTop: 6 },
});