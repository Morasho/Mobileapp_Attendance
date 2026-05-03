import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, RefreshControl, ActivityIndicator,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import api from "../services/api";

export default function AdminDashboardScreen({ navigation, setToken }) {
  const [stats, setStats]   = useState(null);
  const [user, setUser]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const raw = await SecureStore.getItemAsync("user");
      if (raw) setUser(JSON.parse(raw));
      const [coursesRes, unitsRes, lecturersRes, studentsRes] = await Promise.all([
        api.get("/admin/courses"),
        api.get("/admin/units"),
        api.get("/admin/lecturers"),
        api.get("/admin/students"),
      ]);
      setStats({
        courses:   coursesRes.data.courses?.length   ?? 0,
        units:     unitsRes.data.units?.length       ?? 0,
        lecturers: lecturersRes.data.lecturers?.length ?? 0,
        students:  studentsRes.data.students?.length  ?? 0,
      });
    } catch {
      Alert.alert("Error", "Could not load dashboard stats");
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

  const actions = [
    { icon: "📖", title: "Courses",   sub: `${stats.courses} course(s)`,             screen: "AdminCourses"   },
    { icon: "📚", title: "Units",     sub: `${stats.units} unit(s) across all courses`, screen: "AdminUnits"     },
    { icon: "👨‍🏫", title: "Lecturers", sub: `${stats.lecturers} lecturer(s) registered`, screen: "AdminLecturers" },
    { icon: "🎓", title: "Students",  sub: `${stats.students} student(s) registered`,  screen: "AdminStudents"  },
    { icon: "📅", title: "Academic Periods", sub: "Manage semesters", screen: "AdminPeriods" },
    { icon: "📊", title: "Semester Report", sub: "Attendance by period", screen: "AdminSemesterReport" },
  ];

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4361ee" />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name?.split(" ")[0]} 👋</Text>
          <Text style={styles.role}>Admin Dashboard</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logout}>Log out</Text>
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      <View style={styles.statsGrid}>
        {[
          { label: "Courses",   val: stats.courses,   color: "#dbe4ff" },
          { label: "Units",     val: stats.units,     color: "#fff3bf" },
          { label: "Lecturers", val: stats.lecturers, color: "#d8f3dc" },
          { label: "Students",  val: stats.students,  color: "#ffe8cc" },
        ].map(s => (
          <View key={s.label} style={[styles.statCard, { backgroundColor: s.color }]}>
            <Text style={styles.statNum}>{s.val}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Manage</Text>

      {actions.map(a => (
        <TouchableOpacity
          key={a.screen}
          style={styles.actionCard}
          onPress={() => navigation.navigate(a.screen)}
        >
          <Text style={styles.actionIcon}>{a.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>{a.title}</Text>
            <Text style={styles.actionSub}>{a.sub}</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flexGrow: 1, padding: 24, backgroundColor: "#f8f9fa" },
  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  greeting:     { fontSize: 22, fontWeight: "700", color: "#1a1a2e" },
  role:         { fontSize: 13, color: "#6c757d", marginTop: 2 },
  logout:       { color: "#e63946", fontSize: 14, fontWeight: "600" },
  statsGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 28 },
  statCard:     { width: "47%", borderRadius: 12, padding: 16, alignItems: "center" },
  statNum:      { fontSize: 28, fontWeight: "700", color: "#1a1a2e" },
  statLabel:    { fontSize: 12, color: "#6c757d", marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#1a1a2e", marginBottom: 12 },
  actionCard:   { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, borderColor: "#dee2e6" },
  actionIcon:   { fontSize: 28 },
  actionTitle:  { fontSize: 15, fontWeight: "600", color: "#1a1a2e" },
  actionSub:    { fontSize: 12, color: "#6c757d", marginTop: 3 },
  arrow:        { fontSize: 22, color: "#adb5bd" },
});