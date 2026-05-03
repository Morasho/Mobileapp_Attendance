import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert, RefreshControl,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import api from "../services/api";

export default function LecturerDashboardScreen({ navigation, setToken }) {
  const [data, setData]         = useState(null);
  const [user, setUser]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const raw = await SecureStore.getItemAsync("user");
      if (raw) setUser(JSON.parse(raw));
      const { data: res } = await api.get("/lecturer/dashboard");
      setData(res);
    } catch {
      Alert.alert("Error", "Could not load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); };

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync("token");
    await SecureStore.deleteItemAsync("user");
    setToken(null);
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#4361ee" />;

  // Group classes by course then year
  const grouped = {};
  (data?.classes || []).forEach(cls => {
    const courseKey = cls.course_name || "My Classes";
    const yearKey   = `Year ${cls.year_of_study}`;
    if (!grouped[courseKey]) grouped[courseKey] = {};
    if (!grouped[courseKey][yearKey]) grouped[courseKey][yearKey] = [];
    grouped[courseKey][yearKey].push(cls);
  });

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4361ee" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name?.split(" ")[0]} 👋</Text>
          <Text style={styles.role}>Lecturer Dashboard</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logout}>Log out</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: "#dbe4ff" }]}>
          <Text style={styles.statNum}>{data?.totalClasses ?? 0}</Text>
          <Text style={styles.statLabel}>My Classes</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#d8f3dc" }]}>
          <Text style={styles.statNum}>{data?.todayAttendance ?? 0}</Text>
          <Text style={styles.statLabel}>Today's Sign-ins</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>

      <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate("SessionManager")}>
        <Text style={styles.actionIcon}>🟢</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Open Attendance</Text>
          <Text style={styles.actionSub}>Start or stop attendance — captures your live GPS</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate("ManageClasses")}>
        <Text style={styles.actionIcon}>📚</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Manage Classes</Text>
          <Text style={styles.actionSub}>Create classes from your assigned units</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate("Profile")}>
        <Text style={styles.actionIcon}>👤</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>My Profile</Text>
          <Text style={styles.actionSub}>View and edit your profile information</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>

      {/* Classes grouped by course → year */}
      {Object.keys(grouped).length > 0 ? (
        Object.entries(grouped).map(([courseName, years]) => (
          <View key={courseName}>
            {/* Course header */}
            <View style={styles.courseHeader}>
              <Text style={styles.courseName}>📖 {courseName}</Text>
            </View>

            {Object.entries(years).map(([yearLabel, classes]) => (
              <View key={yearLabel}>
                {/* Year sub-header */}
                <Text style={styles.yearLabel}>{yearLabel}</Text>

                {classes.map(cls => (
                  <View key={cls.id} style={styles.classRow}>
                    <View style={styles.classBadge}>
                      <Text style={styles.classBadgeText}>{cls.unit_code}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.className}>{cls.unit_name}</Text>
                      <Text style={styles.classMeta}>Sem {cls.semester}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.reportBtn, cls.session_active && styles.reportBtnLive]}
                      onPress={() => navigation.navigate("Report", {
                        classId: cls.id, className: cls.unit_name,
                      })}
                    >
                      <Text style={styles.reportBtnText}>
                        {cls.session_active ? "🟢 Live" : "📊 Report"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No classes yet.</Text>
          <Text style={styles.emptyHint}>
            Tap "Manage Classes" to create classes from your assigned units.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flexGrow: 1, padding: 24, backgroundColor: "#f8f9fa" },
  header:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  greeting:       { fontSize: 22, fontWeight: "700", color: "#1a1a2e" },
  role:           { fontSize: 13, color: "#6c757d", marginTop: 2 },
  logout:         { color: "#e63946", fontSize: 14, fontWeight: "600" },
  statsRow:       { flexDirection: "row", gap: 12, marginBottom: 28 },
  statCard:       { flex: 1, borderRadius: 12, padding: 18, alignItems: "center" },
  statNum:        { fontSize: 30, fontWeight: "700", color: "#1a1a2e" },
  statLabel:      { fontSize: 12, color: "#6c757d", marginTop: 4, textAlign: "center" },
  sectionTitle:   { fontSize: 15, fontWeight: "700", color: "#1a1a2e", marginBottom: 12 },
  actionCard:     { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, borderColor: "#dee2e6" },
  actionIcon:     { fontSize: 28 },
  actionTitle:    { fontSize: 15, fontWeight: "600", color: "#1a1a2e" },
  actionSub:      { fontSize: 12, color: "#6c757d", marginTop: 3 },
  arrow:          { fontSize: 22, color: "#adb5bd" },
  courseHeader:   { backgroundColor: "#dbe4ff", borderRadius: 10, padding: 12, marginTop: 20, marginBottom: 8 },
  courseName:     { fontSize: 14, fontWeight: "700", color: "#3451b2" },
  yearLabel:      { fontSize: 12, fontWeight: "700", color: "#6c757d", marginBottom: 8, marginLeft: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  classRow:       { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#dee2e6" },
  classBadge:     { backgroundColor: "#dbe4ff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  classBadgeText: { color: "#3451b2", fontWeight: "700", fontSize: 12 },
  className:      { fontSize: 14, fontWeight: "600", color: "#1a1a2e" },
  classMeta:      { fontSize: 11, color: "#adb5bd", marginTop: 2 },
  reportBtn:      { backgroundColor: "#dbe4ff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  reportBtnLive:  { backgroundColor: "#d8f3dc" },
  reportBtnText:  { color: "#3451b2", fontSize: 12, fontWeight: "700" },
  empty:          { alignItems: "center", marginTop: 40 },
  emptyText:      { fontSize: 16, color: "#adb5bd", fontWeight: "600" },
  emptyHint:      { fontSize: 13, color: "#adb5bd", marginTop: 6, textAlign: "center" },
});