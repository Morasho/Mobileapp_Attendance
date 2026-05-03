import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Alert, RefreshControl,
  Share, Platform,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import api from "../services/api";

export default function AdminSemesterReportScreen() {
  const [periods, setPeriods]       = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [summary, setSummary]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedClass, setExpandedClass] = useState(null);

  const loadPeriods = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/periods");
      const list = data.periods || [];
      setPeriods(list);
      // Auto-select active period
      const active = list.find(p => p.is_active);
      if (active) setSelectedPeriod(String(active.id));
    } catch {
      Alert.alert("Error", "Could not load periods");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadPeriods(); }, []);
  const onRefresh = () => { setRefreshing(true); loadPeriods(); };

  useEffect(() => {
    if (selectedPeriod) fetchSummary(selectedPeriod);
    else setSummary(null);
  }, [selectedPeriod]);

  const fetchSummary = async (periodId) => {
    setReportLoading(true);
    setSummary(null);
    try {
      const { data } = await api.get(`/admin/periods/${periodId}/summary`);
      setSummary(data);
    } catch {
      Alert.alert("Error", "Could not load report");
    } finally {
      setReportLoading(false);
    }
  };

  const exportCSV = async () => {
    if (!selectedPeriod) return;
    try {
      // Fetch CSV as text
      const { data } = await api.get(
        `/admin/periods/${selectedPeriod}/report/csv`,
        { responseType: "text" }
      );

      const period = periods.find(p => String(p.id) === selectedPeriod);
      const filename = `attendance_${period?.academic_year || "report"}_sem${period?.semester || ""}.csv`;

      await Share.share({
        title:   filename,
        message: typeof data === "string" ? data : JSON.stringify(data),
      });
    } catch (err) {
      Alert.alert("Export failed", err.message || "Could not export CSV");
    }
  };

  const toggleClass = (classId) => {
    setExpandedClass(prev => prev === classId ? null : classId);
  };

  const rateColor = (rate) => {
    if (rate >= 75) return "#2d6a4f";
    if (rate >= 50) return "#856404";
    return "#c0392b";
  };

  const rateBg = (rate) => {
    if (rate >= 75) return "#d8f3dc";
    if (rate >= 50) return "#fff3bf";
    return "#ffe0e0";
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#4361ee" />;

  const period = periods.find(p => String(p.id) === selectedPeriod);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4361ee" />}
    >
      {/* Period selector */}
      <Text style={styles.label}>Academic Period</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={selectedPeriod}
          onValueChange={setSelectedPeriod}
          style={styles.picker}
        >
          <Picker.Item label="Select a period..." value="" />
          {periods.map(p => (
            <Picker.Item
              key={p.id}
              label={`${p.name}${p.is_active ? " (Active)" : ""}`}
              value={String(p.id)}
            />
          ))}
        </Picker>
      </View>

      {/* Export button */}
      {selectedPeriod && !reportLoading && summary && (
        <TouchableOpacity style={styles.exportBtn} onPress={exportCSV}>
          <Text style={styles.exportBtnText}>⬇️  Export Full CSV</Text>
        </TouchableOpacity>
      )}

      {reportLoading && (
        <View style={styles.center}>
          <ActivityIndicator color="#4361ee" />
          <Text style={styles.loadingText}>Generating report...</Text>
        </View>
      )}

      {summary && !reportLoading && (
        <>
          {/* Period info */}
          <View style={styles.periodCard}>
            <Text style={styles.periodName}>{summary.period.name}</Text>
            <Text style={styles.periodMeta}>
              {summary.period.start_date?.split("T")[0]} → {summary.period.end_date?.split("T")[0]}
            </Text>
            <View style={styles.periodStats}>
              <View style={styles.periodStat}>
                <Text style={styles.periodStatNum}>{summary.classes.length}</Text>
                <Text style={styles.periodStatLabel}>Classes</Text>
              </View>
              <View style={styles.periodStat}>
                <Text style={styles.periodStatNum}>
                  {summary.classes.reduce((a, c) => a + parseInt(c.total_sessions), 0)}
                </Text>
                <Text style={styles.periodStatLabel}>Sessions</Text>
              </View>
              <View style={styles.periodStat}>
                <Text style={styles.periodStatNum}>
                  {new Set(summary.classes.flatMap(c => c.students.map(s => s.student_id))).size}
                </Text>
                <Text style={styles.periodStatLabel}>Students</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Attendance by Unit</Text>
          <Text style={styles.sectionHint}>Tap a unit to see per-student breakdown</Text>

          {summary.classes.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No attendance data for this period.</Text>
            </View>
          )}

          {summary.classes.map(cls => {
            const isExpanded = expandedClass === cls.class_id;
            const avgRate = cls.students.length > 0
              ? Math.round(cls.students.reduce((a, s) => a + s.rate, 0) / cls.students.length)
              : 0;

            return (
              <View key={cls.class_id} style={styles.classCard}>
                {/* Class header — tap to expand */}
                <TouchableOpacity
                  style={styles.classHeader}
                  onPress={() => toggleClass(cls.class_id)}
                >
                  <View style={styles.classBadge}>
                    <Text style={styles.classBadgeText}>{cls.unit_code}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.className}>{cls.unit_name}</Text>
                    <Text style={styles.classMeta}>
                      {cls.lecturer_name} · {cls.total_sessions} session(s)
                    </Text>
                    <Text style={styles.classMeta}>
                      {cls.course_name} · Yr {cls.year_of_study} Sem {cls.semester}
                    </Text>
                  </View>
                  <View style={[styles.avgBadge, { backgroundColor: rateBg(avgRate) }]}>
                    <Text style={[styles.avgRate, { color: rateColor(avgRate) }]}>
                      {avgRate}%
                    </Text>
                    <Text style={[styles.avgLabel, { color: rateColor(avgRate) }]}>avg</Text>
                  </View>
                  <Text style={styles.chevron}>{isExpanded ? "▲" : "▼"}</Text>
                </TouchableOpacity>

                {/* Student breakdown */}
                {isExpanded && (
                  <View style={styles.studentTable}>
                    {/* Header row */}
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableCell, styles.tableCellName]}>Student</Text>
                      <Text style={styles.tableCell}>ID</Text>
                      <Text style={styles.tableCell}>Attended</Text>
                      <Text style={styles.tableCell}>Rate</Text>
                    </View>

                    {cls.students.length === 0 && (
                      <Text style={styles.noStudents}>No attendance recorded</Text>
                    )}

                    {cls.students
                      .sort((a, b) => b.rate - a.rate)
                      .map(s => (
                        <View key={s.student_id} style={styles.tableRow}>
                          <Text style={[styles.tableCell, styles.tableCellName]} numberOfLines={1}>
                            {s.student_name}
                          </Text>
                          <Text style={styles.tableCell}>{s.reg_number}</Text>
                          <Text style={styles.tableCell}>{s.attended}/{s.total}</Text>
                          <View style={[styles.rateCell, { backgroundColor: rateBg(s.rate) }]}>
                            <Text style={[styles.rateCellText, { color: rateColor(s.rate) }]}>
                              {s.rate}%
                            </Text>
                          </View>
                        </View>
                      ))
                    }

                    {/* At-risk warning */}
                    {cls.students.filter(s => s.rate < 75).length > 0 && (
                      <View style={styles.atRiskBanner}>
                        <Text style={styles.atRiskText}>
                          ⚠️ {cls.students.filter(s => s.rate < 75).length} student(s) below 75% attendance
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:        { flexGrow: 1, padding: 20, backgroundColor: "#f8f9fa" },
  label:            { fontSize: 13, fontWeight: "700", color: "#495057", marginBottom: 8 },
  pickerWrap:       { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#dee2e6", marginBottom: 16, overflow: "hidden" },
  picker:           { height: 50, color: "#1a1a2e" },
  exportBtn:        { backgroundColor: "#2d6a4f", borderRadius: 12, padding: 14, alignItems: "center", marginBottom: 20 },
  exportBtnText:    { color: "#fff", fontWeight: "700", fontSize: 14 },
  center:           { alignItems: "center", paddingVertical: 30 },
  loadingText:      { marginTop: 10, color: "#6c757d", fontSize: 14 },
  periodCard:       { backgroundColor: "#dbe4ff", borderRadius: 14, padding: 18, marginBottom: 20 },
  periodName:       { fontSize: 17, fontWeight: "700", color: "#3451b2", marginBottom: 4 },
  periodMeta:       { fontSize: 13, color: "#3451b2", marginBottom: 14 },
  periodStats:      { flexDirection: "row", gap: 12 },
  periodStat:       { flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 12, alignItems: "center" },
  periodStatNum:    { fontSize: 24, fontWeight: "700", color: "#1a1a2e" },
  periodStatLabel:  { fontSize: 11, color: "#6c757d", marginTop: 2 },
  sectionTitle:     { fontSize: 15, fontWeight: "700", color: "#1a1a2e", marginBottom: 4 },
  sectionHint:      { fontSize: 12, color: "#adb5bd", marginBottom: 14 },
  classCard:        { backgroundColor: "#fff", borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: "#dee2e6", overflow: "hidden" },
  classHeader:      { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  classBadge:       { backgroundColor: "#dbe4ff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  classBadgeText:   { color: "#3451b2", fontWeight: "700", fontSize: 12 },
  className:        { fontSize: 14, fontWeight: "600", color: "#1a1a2e" },
  classMeta:        { fontSize: 11, color: "#adb5bd", marginTop: 2 },
  avgBadge:         { borderRadius: 8, padding: 8, alignItems: "center", minWidth: 50 },
  avgRate:          { fontSize: 16, fontWeight: "700" },
  avgLabel:         { fontSize: 10, fontWeight: "600" },
  chevron:          { fontSize: 12, color: "#adb5bd", marginLeft: 4 },
  studentTable:     { borderTopWidth: 1, borderTopColor: "#f1f3f5" },
  tableHeader:      { flexDirection: "row", backgroundColor: "#f8f9fa", padding: 10, gap: 6 },
  tableRow:         { flexDirection: "row", padding: 10, gap: 6, borderTopWidth: 1, borderTopColor: "#f8f9fa" },
  tableCell:        { flex: 1, fontSize: 12, color: "#495057", textAlign: "center" },
  tableCellName:    { flex: 2, textAlign: "left" },
  rateCell:         { flex: 1, borderRadius: 6, paddingVertical: 2, alignItems: "center" },
  rateCellText:     { fontSize: 12, fontWeight: "700" },
  noStudents:       { padding: 14, color: "#adb5bd", fontSize: 13, textAlign: "center" },
  atRiskBanner:     { backgroundColor: "#fff3bf", padding: 10, borderTopWidth: 1, borderTopColor: "#ffd43b" },
  atRiskText:       { color: "#856404", fontSize: 12, fontWeight: "600" },
  empty:            { alignItems: "center", marginTop: 40 },
  emptyText:        { fontSize: 15, color: "#adb5bd", fontWeight: "600" },
});