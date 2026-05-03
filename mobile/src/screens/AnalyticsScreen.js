import { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet,
  Text, TouchableOpacity, View, RefreshControl,
} from "react-native";
import api from "../services/api";

const rateColor = (rate) => {
  if (rate === null) return "#adb5bd";
  if (rate >= 75)   return "#2d6a4f";
  if (rate >= 50)   return "#856404";
  return "#c0392b";
};

const rateBg = (rate) => {
  if (rate === null) return "#f1f3f5";
  if (rate >= 75)   return "#d8f3dc";
  if (rate >= 50)   return "#fff3bf";
  return "#ffe0e0";
};

export default function AnalyticsScreen({ navigation }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab]           = useState("summary"); // "summary" | "log"

  const fetch = useCallback(async () => {
    try {
      const { data: res } = await api.get("/attendance/my-summary");
      setData(res);
    } catch {
      Alert.alert("Error", "Could not load attendance summary.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, []);
  const onRefresh = () => { setRefreshing(true); fetch(); };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4361ee" />
      </View>
    );
  }

  const summary    = data?.summary    || [];
  const recentLogs = data?.recentLogs || [];
  const period     = data?.period;

  // Overall stats
  const totalSessions = summary.reduce((a, u) => a + u.total_sessions, 0);
  const totalAttended = summary.reduce((a, u) => a + u.attended, 0);
  const overallRate   = totalSessions > 0
    ? Math.round((totalAttended / totalSessions) * 100) : 0;
  const atRisk        = summary.filter(u => u.rate !== null && u.rate < 75).length;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4361ee" />}
    >
      {/* Period banner */}
      {period ? (
        <View style={styles.periodBanner}>
          <Text style={styles.periodText}>📅 {period.name}</Text>
        </View>
      ) : (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>⚠️ No active semester — showing all-time data</Text>
        </View>
      )}

      {/* Overall stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: "#dbe4ff" }]}>
          <Text style={styles.statNum}>{totalSessions}</Text>
          <Text style={styles.statLabel}>Sessions held</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#d8f3dc" }]}>
          <Text style={styles.statNum}>{totalAttended}</Text>
          <Text style={styles.statLabel}>Attended</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: rateBg(overallRate) }]}>
          <Text style={[styles.statNum, { color: rateColor(overallRate) }]}>
            {overallRate}%
          </Text>
          <Text style={styles.statLabel}>Overall</Text>
        </View>
      </View>

      {/* At-risk warning */}
      {atRisk > 0 && (
        <View style={styles.atRiskBanner}>
          <Text style={styles.atRiskText}>
            ⚠️ You are below 75% in {atRisk} unit{atRisk > 1 ? "s" : ""} — risk of deregistration
          </Text>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === "summary" && styles.tabActive]}
          onPress={() => setTab("summary")}
        >
          <Text style={[styles.tabText, tab === "summary" && styles.tabTextActive]}>
            Per Unit
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "log" && styles.tabActive]}
          onPress={() => setTab("log")}
        >
          <Text style={[styles.tabText, tab === "log" && styles.tabTextActive]}>
            Recent Log
          </Text>
        </TouchableOpacity>
      </View>

      {/* Per-unit summary */}
      {tab === "summary" && (
        <>
          {summary.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No data yet.</Text>
              <Text style={styles.emptyHint}>Sign in to classes to see your attendance here.</Text>
            </View>
          )}

          {summary.map(u => (
            <View key={u.unit_id} style={styles.unitCard}>
              <View style={styles.unitTop}>
                <View style={styles.unitBadge}>
                  <Text style={styles.unitCode}>{u.unit_code}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.unitName}>{u.unit_name}</Text>
                  <Text style={styles.unitMeta}>Semester {u.semester}</Text>
                </View>
                <View style={[styles.rateBadge, { backgroundColor: rateBg(u.rate) }]}>
                  <Text style={[styles.rateNum, { color: rateColor(u.rate) }]}>
                    {u.rate !== null ? `${u.rate}%` : "—"}
                  </Text>
                  <Text style={[styles.rateLabel, { color: rateColor(u.rate) }]}>
                    {u.attended}/{u.total_sessions}
                  </Text>
                </View>
              </View>

              {/* Progress bar */}
              <View style={styles.progressBg}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${u.rate || 0}%`,
                      backgroundColor: rateColor(u.rate),
                    },
                  ]}
                />
                {/* 75% threshold marker */}
                <View style={styles.thresholdMarker} />
              </View>
              <Text style={styles.progressHint}>
                {u.rate === null
                  ? "No sessions held yet"
                  : u.rate >= 75
                  ? "✓ Above minimum attendance"
                  : `Need ${Math.ceil(u.total_sessions * 0.75) - u.attended} more session(s) to reach 75%`
                }
              </Text>
            </View>
          ))}

          {/* Chart — attendance trend using simple bars */}
          {recentLogs.length > 0 && (
            <View style={styles.trendCard}>
              <Text style={styles.trendTitle}>Last 10 sign-ins</Text>
              <View style={styles.trendBars}>
                {recentLogs.slice().reverse().map((log, i) => (
                  <View key={log.id} style={styles.trendBar}>
                    <View
                      style={[
                        styles.trendBarFill,
                        {
                          backgroundColor: log.status === "present" ? "#2d6a4f" : "#c0392b",
                          height: log.status === "present" ? 40 : 20,
                        },
                      ]}
                    />
                    <Text style={styles.trendBarLabel} numberOfLines={1}>
                      {log.unit_code}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.trendLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#2d6a4f" }]} />
                  <Text style={styles.legendText}>Present</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#c0392b" }]} />
                  <Text style={styles.legendText}>Absent</Text>
                </View>
              </View>
            </View>
          )}
        </>
      )}

      {/* Recent log tab */}
      {tab === "log" && (
        <>
          {recentLogs.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No recent sign-ins.</Text>
            </View>
          )}
          {recentLogs.map(log => (
            <View key={log.id} style={styles.logItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.logClass}>{log.class_name}</Text>
                <Text style={styles.logCode}>{log.unit_code}</Text>
                <Text style={styles.logDist}>{log.distance_m}m from classroom</Text>
                {log.next_class_date && (
                  <Text style={styles.nextClass}>
                    📅 Next class: {log.next_class_date}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.logDate}>
                  {new Date(log.signed_at).toLocaleDateString()}
                </Text>
                <Text style={styles.logTime}>
                  {new Date(log.signed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
                <View style={[styles.badge, log.status === "present" ? styles.presentBadge : styles.absentBadge]}>
                  <Text style={styles.badgeText}>{log.status}</Text>
                </View>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flexGrow: 1, padding: 20, backgroundColor: "#f8f9fa" },
  center:         { flex: 1, justifyContent: "center", alignItems: "center" },
  periodBanner:   { backgroundColor: "#dbe4ff", borderRadius: 10, padding: 10, marginBottom: 14 },
  periodText:     { color: "#3451b2", fontWeight: "600", fontSize: 13 },
  warningBanner:  { backgroundColor: "#fff3bf", borderRadius: 10, padding: 10, marginBottom: 14 },
  warningText:    { color: "#856404", fontWeight: "600", fontSize: 12 },
  statsRow:       { flexDirection: "row", gap: 10, marginBottom: 14 },
  statCard:       { flex: 1, borderRadius: 12, padding: 14, alignItems: "center" },
  statNum:        { fontSize: 24, fontWeight: "700", color: "#1a1a2e" },
  statLabel:      { fontSize: 11, color: "#6c757d", marginTop: 3, textAlign: "center" },
  atRiskBanner:   { backgroundColor: "#ffe0e0", borderRadius: 10, padding: 12, marginBottom: 14 },
  atRiskText:     { color: "#c0392b", fontWeight: "600", fontSize: 13 },
  tabRow:         { flexDirection: "row", backgroundColor: "#f1f3f5", borderRadius: 10, padding: 4, marginBottom: 16 },
  tab:            { flex: 1, padding: 10, borderRadius: 8, alignItems: "center" },
  tabActive:      { backgroundColor: "#fff" },
  tabText:        { fontSize: 13, fontWeight: "600", color: "#6c757d" },
  tabTextActive:  { color: "#1a1a2e" },
  unitCard:       { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#dee2e6" },
  unitTop:        { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  unitBadge:      { backgroundColor: "#dbe4ff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  unitCode:       { color: "#3451b2", fontWeight: "700", fontSize: 12 },
  unitName:       { fontSize: 14, fontWeight: "600", color: "#1a1a2e" },
  unitMeta:       { fontSize: 11, color: "#adb5bd", marginTop: 2 },
  rateBadge:      { borderRadius: 10, padding: 10, alignItems: "center", minWidth: 56 },
  rateNum:        { fontSize: 18, fontWeight: "700" },
  rateLabel:      { fontSize: 10, fontWeight: "600", marginTop: 1 },
  progressBg:     { height: 8, backgroundColor: "#f1f3f5", borderRadius: 4, overflow: "hidden", position: "relative" },
  progressFill:   { height: 8, borderRadius: 4, position: "absolute", left: 0, top: 0 },
  thresholdMarker:{ position: "absolute", left: "75%", top: 0, width: 2, height: 8, backgroundColor: "#495057" },
  progressHint:   { fontSize: 11, color: "#6c757d", marginTop: 6 },
  trendCard:      { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginTop: 8, borderWidth: 1, borderColor: "#dee2e6" },
  trendTitle:     { fontSize: 13, fontWeight: "700", color: "#1a1a2e", marginBottom: 14 },
  trendBars:      { flexDirection: "row", alignItems: "flex-end", gap: 6, height: 60 },
  trendBar:       { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  trendBarFill:   { width: "100%", borderRadius: 3, minHeight: 4 },
  trendBarLabel:  { fontSize: 9, color: "#adb5bd", marginTop: 4, textAlign: "center" },
  trendLegend:    { flexDirection: "row", gap: 16, marginTop: 12, justifyContent: "center" },
  legendItem:     { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot:      { width: 10, height: 10, borderRadius: 5 },
  legendText:     { fontSize: 12, color: "#6c757d" },
  logItem:        { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#dee2e6" },
  logClass:       { fontSize: 14, fontWeight: "600", color: "#1a1a2e" },
  logCode:        { fontSize: 12, color: "#6c757d", marginTop: 2 },
  logDist:        { fontSize: 11, color: "#adb5bd", marginTop: 3 },
  nextClass:      { fontSize: 11, color: "#4361ee", marginTop: 3, fontWeight: "600" },
  logDate:        { fontSize: 12, color: "#495057" },
  logTime:        { fontSize: 11, color: "#adb5bd", marginTop: 1 },
  badge:          { marginTop: 6, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  presentBadge:   { backgroundColor: "#d8f3dc" },
  absentBadge:    { backgroundColor: "#ffe0e0" },
  badgeText:      { fontSize: 11, fontWeight: "700", color: "#1a1a2e" },
  empty:          { alignItems: "center", marginTop: 40 },
  emptyText:      { fontSize: 16, color: "#adb5bd", fontWeight: "600" },
  emptyHint:      { fontSize: 13, color: "#adb5bd", marginTop: 6 },
});