import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ActivityIndicator,
  ScrollView, RefreshControl, TextInput,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import api from "../services/api";

export default function AdminStudentsScreen() {
  const [students, setStudents]   = useState([]);
  const [courses, setCourses]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]       = useState("");
  const [filterCourse, setFilterCourse] = useState("");
  const [filterYear, setFilterYear]     = useState("");

  const load = useCallback(async () => {
    try {
      const [studRes, courseRes] = await Promise.all([
        api.get("/admin/students"),
        api.get("/admin/courses"),
      ]);
      setStudents(studRes.data.students || []);
      setCourses(courseRes.data.courses || []);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = students.filter(s => {
    if (filterCourse && s.course_id !== filterCourse) return false;
    if (filterYear   && String(s.year_of_study) !== filterYear) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) &&
        !s.student_id?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#4361ee" />;

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search by name or student ID..."
        placeholderTextColor="#adb5bd"
        value={search}
        onChangeText={setSearch}
      />

      <View style={styles.filterRow}>
        <View style={[styles.pickerWrap, { flex: 2 }]}>
          <Picker selectedValue={filterCourse} onValueChange={setFilterCourse} style={styles.picker}>
            <Picker.Item label="All courses" value="" />
            {courses.map(c => <Picker.Item key={c.id} label={c.code} value={c.id} />)}
          </Picker>
        </View>
        <View style={[styles.pickerWrap, { flex: 1 }]}>
          <Picker selectedValue={filterYear} onValueChange={setFilterYear} style={styles.picker}>
            <Picker.Item label="All years" value="" />
            {[1,2,3,4].map(y => <Picker.Item key={y} label={`Yr ${y}`} value={String(y)} />)}
          </Picker>
        </View>
      </View>

      <Text style={styles.count}>{filtered.length} student(s)</Text>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4361ee" />}>
        {filtered.map(s => (
          <View key={s.id} style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{s.name[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{s.name}</Text>
              <Text style={styles.meta}>{s.student_id} · {s.email}</Text>
              <Text style={styles.meta2}>
                {s.course_name || "No course"} · Year {s.year_of_study} · Sem {s.semester}
              </Text>
            </View>
          </View>
        ))}
        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No students found.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, padding: 20, backgroundColor: "#f8f9fa" },
  search:     { backgroundColor: "#fff", borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#dee2e6", fontSize: 14, color: "#1a1a2e" },
  filterRow:  { flexDirection: "row", gap: 8, marginBottom: 10 },
  pickerWrap: { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#dee2e6", overflow: "hidden" },
  picker:     { height: 50, color: "#1a1a2e" },
  count:      { fontSize: 12, color: "#6c757d", marginBottom: 12, fontWeight: "600" },
  card:       { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#dee2e6", flexDirection: "row", alignItems: "center", gap: 12 },
  avatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff3bf", justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 16, fontWeight: "700", color: "#e67700" },
  name:       { fontSize: 15, fontWeight: "600", color: "#1a1a2e" },
  meta:       { fontSize: 12, color: "#6c757d", marginTop: 2 },
  meta2:      { fontSize: 11, color: "#adb5bd", marginTop: 2 },
  empty:      { alignItems: "center", marginTop: 40 },
  emptyText:  { fontSize: 15, color: "#adb5bd", fontWeight: "600" },
});