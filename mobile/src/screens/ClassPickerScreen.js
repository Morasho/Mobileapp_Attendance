import { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import api from "../services/api";

export default function ClassPickerScreen({ navigation }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/classes")
      .then(({ data }) => setClasses(data.classes))
      .catch(() => Alert.alert("Error", "Could not load classes. Make sure your backend is running."))
      .finally(() => setLoading(false));
  }, []);

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
      <Text style={styles.heading}>Select Your Class</Text>
      <Text style={styles.sub}>Tap a class to mark attendance or view its report</Text>

      <FlatList
        data={classes}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {/* Class info */}
            <View style={styles.cardTop}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.course_code}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.className}>{item.name}</Text>
                {item.lecturer ? (
                  <Text style={styles.lecturer}>👤 {item.lecturer}</Text>
                ) : null}
              </View>
            </View>

            {/* Action buttons */}
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.attendBtn}
                onPress={() => navigation.navigate("Home", {
                  classId: item.id,
                  className: item.name,
                })}
              >
                <Text style={styles.attendBtnText}>📍 Mark Attendance</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.reportBtn}
                onPress={() => navigation.navigate("Report", {
                  classId: item.id,
                  className: item.name,
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
            <Text style={styles.emptyHint}>Ask your lecturer to add a class via the API.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, padding: 20, backgroundColor: "#f8f9fa" },
  center:       { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8f9fa" },
  loadingText:  { marginTop: 12, color: "#6c757d", fontSize: 14 },
  heading:      { fontSize: 24, fontWeight: "700", color: "#1a1a2e", marginBottom: 4 },
  sub:          { fontSize: 14, color: "#6c757d", marginBottom: 24 },
  card:         { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#dee2e6" },
  cardTop:      { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  badge:        { backgroundColor: "#dbe4ff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText:    { color: "#3451b2", fontWeight: "700", fontSize: 13 },
  className:    { fontSize: 15, fontWeight: "600", color: "#1a1a2e" },
  lecturer:     { fontSize: 12, color: "#6c757d", marginTop: 3 },
  cardActions:  { flexDirection: "row", gap: 10 },
  attendBtn:    { flex: 2, backgroundColor: "#4361ee", borderRadius: 8, padding: 10, alignItems: "center" },
  attendBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  reportBtn:    { flex: 1, backgroundColor: "#f1f3f5", borderRadius: 8, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "#dee2e6" },
  reportBtnText: { color: "#495057", fontWeight: "600", fontSize: 13 },
  empty:        { alignItems: "center", marginTop: 60 },
  emptyText:    { fontSize: 16, color: "#adb5bd", fontWeight: "600" },
  emptyHint:    { fontSize: 13, color: "#adb5bd", marginTop: 6, textAlign: "center" },
});