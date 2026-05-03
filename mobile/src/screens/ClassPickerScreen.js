import { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator, Alert, FlatList, StyleSheet, Text,
  TouchableOpacity, View, RefreshControl,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import api from "../services/api";

export default function ClassPickerScreen({ navigation, setToken }) {
  const [classes, setClasses]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchClasses = useCallback(async () => {
    try {
      const { data } = await api.get("/classes");
      setClasses(data.classes);
    } catch {
      Alert.alert("Error", "Could not load classes. Make sure your backend is running.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchClasses(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchClasses(); };

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync("token");
    await SecureStore.deleteItemAsync("user");
    setToken(null);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4361ee" />
        <Text style={styles.loadingText}>Loading classes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>My Classes</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logout}>Log out</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.sub}>Only classes for your course and year are shown</Text>

      <FlatList
        data={classes}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4361ee" />
        }
        renderItem={({ item }) => (
          <View style={[styles.card, item.session_active && styles.cardActive]}>
            <View style={styles.cardTop}>
              {/* Unit code badge */}
              <View style={[styles.badge, item.session_active && styles.badgeActive]}>
                <Text style={[styles.badgeText, item.session_active && styles.badgeTextActive]}>
                  {item.unit_code}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.className}>{item.unit_name}</Text>
                <Text style={styles.meta}>
                  Year {item.year_of_study} · Sem {item.semester}
                </Text>
                {item.lecturer ? (
                  <Text style={styles.lecturer}>👤 {item.lecturer}</Text>
                ) : null}
              </View>
              {/* Live indicator */}
              {item.session_active && (
                <View style={styles.liveBadge}>
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              )}
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={[styles.attendBtn, !item.session_active && styles.attendBtnDisabled]}
                onPress={() => {
                  if (!item.session_active) {
                    Alert.alert("No active session", "Your lecturer hasn't opened attendance yet.");
                    return;
                  }
                  navigation.navigate("Home", { classId: item.id, className: item.unit_name });
                }}
              >
                <Text style={styles.attendBtnText}>📍 Mark Attendance</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reportBtn}
                onPress={() => navigation.navigate("Report", {
                  classId: item.id, className: item.unit_name,
                })}
              >
                <Text style={styles.reportBtnText}>📊 Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No classes found.</Text>
            <Text style={styles.emptyHint}>
              Your lecturer needs to create a class for your course and year.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, padding: 20, backgroundColor: "#f8f9fa" },
  center:             { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8f9fa" },
  loadingText:        { marginTop: 12, color: "#6c757d", fontSize: 14 },
  header:             { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  heading:            { fontSize: 24, fontWeight: "700", color: "#1a1a2e" },
  logout:             { color: "#e63946", fontSize: 14, fontWeight: "600" },
  sub:                { fontSize: 13, color: "#6c757d", marginBottom: 24 },
  card:               { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#dee2e6" },
  cardActive:         { borderColor: "#2d6a4f", backgroundColor: "#f0fdf4" },
  cardTop:            { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  badge:              { backgroundColor: "#dbe4ff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  badgeActive:        { backgroundColor: "#d8f3dc" },
  badgeText:          { color: "#3451b2", fontWeight: "700", fontSize: 13 },
  badgeTextActive:    { color: "#2d6a4f" },
  className:          { fontSize: 15, fontWeight: "600", color: "#1a1a2e" },
  meta:               { fontSize: 11, color: "#adb5bd", marginTop: 2 },
  lecturer:           { fontSize: 12, color: "#6c757d", marginTop: 3 },
  liveBadge:          { backgroundColor: "#2d6a4f", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  liveText:           { color: "#fff", fontSize: 10, fontWeight: "700" },
  cardActions:        { flexDirection: "row", gap: 10 },
  attendBtn:          { flex: 2, backgroundColor: "#4361ee", borderRadius: 8, padding: 10, alignItems: "center" },
  attendBtnDisabled:  { backgroundColor: "#adb5bd" },
  attendBtnText:      { color: "#fff", fontWeight: "700", fontSize: 13 },
  reportBtn:          { flex: 1, backgroundColor: "#f1f3f5", borderRadius: 8, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "#dee2e6" },
  reportBtnText:      { color: "#495057", fontWeight: "600", fontSize: 13 },
  empty:              { alignItems: "center", marginTop: 60 },
  emptyText:          { fontSize: 16, color: "#adb5bd", fontWeight: "600" },
  emptyHint:          { fontSize: 13, color: "#adb5bd", marginTop: 6, textAlign: "center" },
});