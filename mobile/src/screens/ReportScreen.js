import { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator, Alert,
  FlatList, StyleSheet, Text,
  TouchableOpacity, View, RefreshControl,
} from "react-native";
import api from "../services/api";

export default function ReportScreen({ route }) {
  const { classId, className } = route.params ?? {};

  const [report, setReport]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [date, setDate]         = useState(new Date().toISOString().split("T")[0]);

  const fetchReport = useCallback(async () => {
    try {
      const { data } = await api.get(`/attendance/report/${classId}?date=${date}`);
      setReport(data);
    } catch {
      Alert.alert("Error", "Could not load report");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [classId, date]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const onRefresh = () => { setRefreshing(true); fetchReport(); };

  const goToPreviousDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().split("T")[0]);
  };

  const goToNextDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    const today = new Date().toISOString().split("T")[0];
    if (d.toISOString().split("T")[0] <= today)
      setDate(d.toISOString().split("T")[0]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4361ee" />
        <Text style={styles.loadingText}>Generating report...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* Class header */}
      <View style={styles.classCard}>
        <Text style={styles.classLabel}>ATTENDANCE REPORT</Text>
        <Text style={styles.className}>{report?.class?.name ?? className}</Text>
        <Text style={styles.courseCode}>
          {report?.class?.courseCode} {report?.class?.lecturer ? `· ${report.class.lecturer}` : ""}
        </Text>
      </View>

      {/* Date navigator */}
      <View style={styles.dateNav}>
        <TouchableOpacity style={styles.dateBtn} onPress={goToPreviousDay}>
          <Text style={styles.dateBtnText}>‹ Prev</Text>
        </TouchableOpacity>
        <Text style={styles.dateText}>{date}</Text>
        <TouchableOpacity style={styles.dateBtn} onPress={goToNextDay}>
          <Text style={styles.dateBtnText}>Next ›</Text>
        </TouchableOpacity>
      </View>

      {/* Summary cards */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: "#dbe4ff" }]}>
          <Text style={styles.statNum}>{report?.summary?.totalPresent ?? 0}</Text>
          <Text style={styles.statLabel}>Present</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#ffe0e0" }]}>
          <Text style={styles.statNum}>{report?.summary?.totalAbsent ?? 0}</Text>
          <Text style={styles.statLabel}>Absent</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#d8f3dc" }]}>
          <Text style={styles.statNum}>{report?.summary?.attendanceRate ?? 0}%</Text>
          <Text style={styles.statLabel}>Rate</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>
        Present Students ({report?.summary?.totalPresent ?? 0})
      </Text>

      <FlatList
        data={report?.records ?? []}
        keyExtractor={(_, i) => i.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4361ee" />
        }
        renderItem={({ item, index }) => (
          <View style={styles.studentRow}>
            <View style={styles.indexCircle}>
              <Text style={styles.indexText}>{index + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.studentName}>{item.name}</Text>
              <Text style={styles.studentId}>{item.student_id}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.signedTime}>
                {new Date(item.signed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
              <Text style={styles.distance}>{item.distance_m}m away</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No attendance records for this date.</Text>
            <Text style={styles.emptyHint}>Pull down to refresh.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, padding: 20, backgroundColor: "#f8f9fa" },
  center:       { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText:  { marginTop: 12, color: "#6c757d", fontSize: 14 },
  classCard:    { backgroundColor: "#dbe4ff", borderRadius: 12, padding: 16, marginBottom: 16 },
  classLabel:   { fontSize: 11, color: "#3451b2", fontWeight: "700", letterSpacing: 0.8 },
  className:    { fontSize: 18, fontWeight: "700", color: "#1a1a2e", marginTop: 4 },
  courseCode:   { fontSize: 13, color: "#3451b2", marginTop: 3 },
  dateNav:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, backgroundColor: "#fff", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "#dee2e6" },
  dateBtn:      { padding: 6, paddingHorizontal: 12 },
  dateBtnText:  { color: "#4361ee", fontWeight: "700", fontSize: 15 },
  dateText:     { fontSize: 15, fontWeight: "600", color: "#1a1a2e" },
  statsRow:     { flexDirection: "row", gap: 10, marginBottom: 20 },
  statCard:     { flex: 1, borderRadius: 12, padding: 14, alignItems: "center" },
  statNum:      { fontSize: 26, fontWeight: "700", color: "#1a1a2e" },
  statLabel:    { fontSize: 12, color: "#6c757d", marginTop: 3 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#1a1a2e", marginBottom: 10 },
  studentRow:   { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#dee2e6", gap: 12 },
  indexCircle:  { width: 30, height: 30, borderRadius: 15, backgroundColor: "#dbe4ff", alignItems: "center", justifyContent: "center" },
  indexText:    { fontSize: 13, fontWeight: "700", color: "#3451b2" },
  studentName:  { fontSize: 14, fontWeight: "600", color: "#1a1a2e" },
  studentId:    { fontSize: 12, color: "#6c757d", marginTop: 2 },
  signedTime:   { fontSize: 13, fontWeight: "600", color: "#2d6a4f" },
  distance:     { fontSize: 11, color: "#adb5bd", marginTop: 2 },
  empty:        { alignItems: "center", marginTop: 40 },
  emptyText:    { color: "#adb5bd", fontSize: 14 },
  emptyHint:    { color: "#adb5bd", fontSize: 12, marginTop: 6 },
});