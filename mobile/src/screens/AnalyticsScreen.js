import { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator, Alert,
  FlatList, StyleSheet, Text, View, RefreshControl,
} from "react-native";
import api from "../services/api";

export default function AnalyticsScreen() {
  const [logs, setLogs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      const { data } = await api.get("/attendance/my-logs");
      setLogs(data.logs);
    } catch {
      Alert.alert("Error", "Could not load attendance. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchLogs(); };

  const total   = logs.length;
  const present = logs.filter((l) => l.status === "present").length;
  const rate    = total ? Math.round((present / total) * 100) : 0;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4361ee" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: "#dbe4ff" }]}>
          <Text style={styles.statNum}>{total}</Text>
          <Text style={styles.statLabel}>Sign-ins</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#d8f3dc" }]}>
          <Text style={styles.statNum}>{present}</Text>
          <Text style={styles.statLabel}>Present</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#fff3cd" }]}>
          <Text style={styles.statNum}>{rate}%</Text>
          <Text style={styles.statLabel}>Rate</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Attendance Log</Text>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4361ee" />
        }
        renderItem={({ item }) => (
          <View style={styles.logItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.logClass}>{item.class_name}</Text>
              <Text style={styles.logCode}>{item.course_code}</Text>
              <Text style={styles.logDist}>{item.distance_m}m from classroom</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.logDate}>
                {new Date(item.signed_at).toLocaleDateString()}
              </Text>
              <Text style={styles.logTime}>
                {new Date(item.signed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
              <View style={[styles.badge, item.status === "present" ? styles.presentBadge : styles.absentBadge]}>
                <Text style={styles.badgeText}>{item.status}</Text>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No attendance records yet.</Text>
            <Text style={styles.emptyHint}>Sign in to your first class to get started.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, padding: 20, backgroundColor: "#f8f9fa" },
  center:       { flex: 1, justifyContent: "center", alignItems: "center" },
  statsRow:     { flexDirection: "row", gap: 10, marginBottom: 24 },
  statCard:     { flex: 1, borderRadius: 12, padding: 14, alignItems: "center" },
  statNum:      { fontSize: 26, fontWeight: "700", color: "#1a1a2e" },
  statLabel:    { fontSize: 12, color: "#6c757d", marginTop: 3 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1a1a2e", marginBottom: 12 },
  logItem:      { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#dee2e6" },
  logClass:     { fontSize: 14, fontWeight: "600", color: "#1a1a2e" },
  logCode:      { fontSize: 12, color: "#6c757d", marginTop: 2 },
  logDist:      { fontSize: 11, color: "#adb5bd", marginTop: 3 },
  logDate:      { fontSize: 12, color: "#495057" },
  logTime:      { fontSize: 11, color: "#adb5bd", marginTop: 1 },
  badge:        { marginTop: 6, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  presentBadge: { backgroundColor: "#d8f3dc" },
  absentBadge:  { backgroundColor: "#ffe0e0" },
  badgeText:    { fontSize: 11, fontWeight: "700", color: "#1a1a2e" },
  empty:        { alignItems: "center", marginTop: 60 },
  emptyText:    { fontSize: 16, color: "#adb5bd", fontWeight: "600" },
  emptyHint:    { fontSize: 13, color: "#adb5bd", marginTop: 6 },
});