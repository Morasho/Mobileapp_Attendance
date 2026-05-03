import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Image, ScrollView,
  StyleSheet, Text, TouchableOpacity, View, RefreshControl,
} from "react-native";
import api from "../services/api";

export default function HomeScreen({ route, navigation, setToken }) {
  const { classId, className } = route.params ?? {};

  const [student, setStudent]         = useState(null);
  const [location, setLocation]       = useState(null);
  const [locError, setLocError]       = useState(null);
  const [loading, setLoading]         = useState(false);
  const [status, setStatus]           = useState(null);
  const [sessionOpen, setSessionOpen] = useState(null);
  const [showCamera, setShowCamera]   = useState(false);
  const [selfie, setSelfie]           = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [refreshing, setRefreshing]   = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const loadStudent = async () => {
    const raw = await SecureStore.getItemAsync("user");
    if (raw) setStudent(JSON.parse(raw));
  };

  const requestLocation = async () => {
    setLocError(null);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setLocError("Location permission denied. Enable it in phone Settings.");
      return;
    }
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      setLocation(loc.coords);
    } catch {
      setLocError("Could not get GPS signal. Move closer to a window and retry.");
    }
  };

// useRef to hold the interval ID so we can clear it on unmount or class change
const intervalRef = useRef(null);

useEffect(() => {
  loadStudent();
  requestLocation();
}, []);

useEffect(() => {
  // Clear any existing interval
  if (intervalRef.current) clearInterval(intervalRef.current);

  if (!classId) {
    setSessionOpen(false);
    return;
  }

  // Check immediately then every 10 seconds
  const check = async () => {
    try {
      const { data } = await api.get(`/sessions/active/${classId}`);
      setSessionOpen(data.active);
      setLastChecked(new Date());
    } catch {
      setSessionOpen(false);
    } finally {
      setRefreshing(false);
    }
  };

  check();
  intervalRef.current = setInterval(check, 10000);

  // Cleanup on unmount or classId change
  return () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };
}, [classId]); // depends only on classId, not checkSession

// Update onRefresh and checkSession button to use the same logic
const onRefresh = () => {
  setRefreshing(true);
  api.get(`/sessions/active/${classId}`)
    .then(({ data }) => { setSessionOpen(data.active); setLastChecked(new Date()); })
    .catch(() => setSessionOpen(false))
    .finally(() => setRefreshing(false));
};

  const openCamera = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert("Camera needed", "Please allow camera access.");
        return;
      }
    }
    setSelfie(null);
    setShowCamera(true);
  };

  const takeSelfie = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5, base64: false, skipProcessing: true,
      });
      setSelfie(photo.uri);
      setShowCamera(false);
    } catch {
      Alert.alert("Error", "Could not take photo. Try again.");
    }
  };

  const handleSignIn = async () => {
    if (!classId)     { Alert.alert("No class", "Go back and select a class first."); return; }
    if (!location)    { Alert.alert("No GPS", locError || "Still acquiring GPS..."); return; }
    if (!selfie)      { Alert.alert("Selfie required", "Please take a selfie before signing in."); return; }
    if (!sessionOpen) { Alert.alert("Session closed", "Your lecturer hasn't opened attendance yet."); return; }

    setLoading(true);
    setStatus(null);
    try {
      const { data } = await api.post("/attendance/sign-in", {
        classId,
        latitude:  location.latitude,
        longitude: location.longitude,
      });
      setStatus({
        type: "success",
        message: `Attendance recorded ✅\nYou were ${data.distanceM}m from the classroom.`,
      });
      setSelfie(null);
    } catch (err) {
      const errMsg = err.response?.data?.error || "Sign-in failed. Please try again.";
      if (err.response?.data?.sessionActive === false) setSessionOpen(false);
      setStatus({ type: "error", message: errMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync("token");
    await SecureStore.deleteItemAsync("user");
    setToken(null);
  };

  // ── Camera view ──────────────────────────────────────────
  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="front">
          <View style={styles.cameraOverlay}>
            <View style={styles.faceGuide} />
            <Text style={styles.cameraHint}>Position your face in the circle</Text>
            <TouchableOpacity style={styles.captureBtn} onPress={takeSelfie}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelCamera} onPress={() => setShowCamera(false)}>
              <Text style={styles.cancelCameraText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  }

  // ── Main screen ──────────────────────────────────────────
  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4361ee" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {student?.name?.split(" ")[0]} 👋</Text>
          <Text style={styles.id}>ID: {student?.studentId}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logout}>Log out</Text>
        </TouchableOpacity>
      </View>

      {/* Selected class */}
      <View style={styles.classCard}>
        <Text style={styles.classLabel}>CURRENT CLASS</Text>
        <Text style={styles.className}>{className ?? "No class selected"}</Text>
        <TouchableOpacity onPress={() => navigation.navigate("ClassPicker")}>
          <Text style={styles.changeClass}>Change class ›</Text>
        </TouchableOpacity>
      </View>

      {/* Session status — auto-refreshes every 10s */}
      {classId && (
        <View style={[
          styles.sessionCard,
          sessionOpen === null ? styles.sessionChecking :
          sessionOpen         ? styles.sessionOpenCard :
                                styles.sessionClosedCard
        ]}>
          {sessionOpen === null ? (
            <View style={styles.row}>
              <ActivityIndicator size="small" color="#6c757d" />
              <Text style={styles.sessionText}>  Checking session...</Text>
            </View>
          ) : sessionOpen ? (
            <>
              <Text style={styles.sessionText}>🟢 Attendance is open — sign in now!</Text>
              {lastChecked && (
                <Text style={styles.sessionMeta}>
                  Checked {lastChecked.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.sessionText}>🔴 Waiting for lecturer to open attendance</Text>
              {lastChecked && (
                <Text style={styles.sessionMeta}>
                  Last checked: {lastChecked.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </Text>
              )}
              <Text style={styles.sessionHint}>Auto-checking every 10s · Pull down to refresh</Text>
              <TouchableOpacity style={styles.recheckBtn} onPress={onRefresh}>
                <Text style={styles.recheckText}>Check now</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* GPS card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📍 Your GPS Location</Text>
        {locError ? (
          <>
            <Text style={styles.locError}>{locError}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={requestLocation}>
              <Text style={styles.retryText}>Retry GPS</Text>
            </TouchableOpacity>
          </>
        ) : location ? (
          <>
            <Text style={styles.coord}>Lat: {location.latitude.toFixed(6)}</Text>
            <Text style={styles.coord}>Lng: {location.longitude.toFixed(6)}</Text>
            <Text style={styles.gpsOk}>GPS signal acquired ✓</Text>
          </>
        ) : (
          <View style={styles.row}>
            <ActivityIndicator size="small" color="#4361ee" />
            <Text style={styles.acquiring}>  Acquiring GPS signal...</Text>
          </View>
        )}
      </View>

      {/* Selfie card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🤳 Identity Verification</Text>
        {selfie ? (
          <View style={styles.selfieRow}>
            <Image source={{ uri: selfie }} style={styles.selfiePreview} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.gpsOk}>Selfie captured ✓</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={openCamera}>
                <Text style={styles.retryText}>Retake</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.selfieHint}>A selfie is required before signing in.</Text>
            <TouchableOpacity style={styles.cameraBtn} onPress={openCamera}>
              <Text style={styles.cameraBtnText}>📷  Take Selfie</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Sign-in button */}
      <TouchableOpacity
        style={[styles.signInBtn,
          (loading || !location || !classId || !selfie || !sessionOpen) && styles.disabled]}
        onPress={handleSignIn}
        disabled={loading || !location || !classId || !selfie || !sessionOpen}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.signInText}>Mark Attendance</Text>
        }
      </TouchableOpacity>

      {sessionOpen && !selfie && (
        <Text style={styles.reminderText}>Take a selfie above to enable sign-in</Text>
      )}

      {/* Result */}
      {status && (
        <View style={[styles.statusBox, status.type === "success" ? styles.successBox : styles.errorBox]}>
          <Text style={styles.statusText}>{status.message}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate("Analytics")}>
        <Text style={styles.secondaryText}>📊 View My Attendance History</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:         { flexGrow: 1, padding: 24, backgroundColor: "#f8f9fa" },
  header:            { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  greeting:          { fontSize: 22, fontWeight: "700", color: "#1a1a2e" },
  id:                { fontSize: 13, color: "#6c757d", marginTop: 2 },
  logout:            { color: "#e63946", fontSize: 14, fontWeight: "600" },
  classCard:         { backgroundColor: "#dbe4ff", borderRadius: 12, padding: 16, marginBottom: 12 },
  classLabel:        { fontSize: 11, color: "#3451b2", fontWeight: "700", letterSpacing: 0.8 },
  className:         { fontSize: 18, fontWeight: "700", color: "#1a1a2e", marginTop: 4 },
  changeClass:       { fontSize: 13, color: "#3451b2", marginTop: 8, fontWeight: "500" },
  sessionCard:       { borderRadius: 12, padding: 14, marginBottom: 12 },
  sessionChecking:   { backgroundColor: "#f1f3f5" },
  sessionOpenCard:   { backgroundColor: "#d8f3dc" },
  sessionClosedCard: { backgroundColor: "#ffe0e0" },
  sessionText:       { fontSize: 14, fontWeight: "600", color: "#1a1a2e" },
  sessionMeta:       { fontSize: 11, color: "#6c757d", marginTop: 4 },
  sessionHint:       { fontSize: 12, color: "#6c757d", marginTop: 4 },
  recheckBtn:        { alignSelf: "flex-start", marginTop: 8, backgroundColor: "#fff", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#dee2e6" },
  recheckText:       { fontSize: 12, color: "#4361ee", fontWeight: "600" },
  card:              { backgroundColor: "#fff", borderRadius: 12, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: "#dee2e6" },
  cardTitle:         { fontSize: 15, fontWeight: "600", marginBottom: 12, color: "#1a1a2e" },
  coord:             { fontSize: 13, color: "#495057", marginBottom: 2 },
  gpsOk:             { marginTop: 4, color: "#2d6a4f", fontWeight: "600", fontSize: 13 },
  locError:          { color: "#c0392b", fontSize: 13, marginBottom: 10 },
  retryBtn:          { alignSelf: "flex-start", backgroundColor: "#ffe0e0", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7, marginTop: 8 },
  retryText:         { color: "#c0392b", fontWeight: "600", fontSize: 13 },
  row:               { flexDirection: "row", alignItems: "center" },
  acquiring:         { color: "#6c757d", fontSize: 13 },
  selfieHint:        { fontSize: 13, color: "#6c757d", marginBottom: 12, lineHeight: 20 },
  cameraBtn:         { backgroundColor: "#1a1a2e", borderRadius: 10, padding: 13, alignItems: "center" },
  cameraBtnText:     { color: "#fff", fontWeight: "600", fontSize: 14 },
  selfieRow:         { flexDirection: "row", alignItems: "center" },
  selfiePreview:     { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: "#2d6a4f" },
  signInBtn:         { backgroundColor: "#4361ee", borderRadius: 12, padding: 18, alignItems: "center", marginBottom: 8 },
  disabled:          { opacity: 0.5 },
  signInText:        { color: "#fff", fontSize: 17, fontWeight: "700" },
  reminderText:      { textAlign: "center", fontSize: 12, color: "#adb5bd", marginBottom: 16 },
  statusBox:         { borderRadius: 12, padding: 16, marginBottom: 16 },
  successBox:        { backgroundColor: "#d8f3dc" },
  errorBox:          { backgroundColor: "#ffe0e0" },
  statusText:        { fontSize: 14, color: "#1a1a2e", lineHeight: 22 },
  secondaryBtn:      { borderRadius: 12, padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#4361ee" },
  secondaryText:     { color: "#4361ee", fontWeight: "600", fontSize: 15 },
  cameraContainer:   { flex: 1, backgroundColor: "#000" },
  camera:            { flex: 1 },
  cameraOverlay:     { flex: 1, alignItems: "center", justifyContent: "center" },
  faceGuide:         { width: 220, height: 220, borderRadius: 110, borderWidth: 3, borderColor: "#fff", borderStyle: "dashed", marginBottom: 20 },
  cameraHint:        { color: "#fff", fontSize: 14, marginBottom: 40, textAlign: "center" },
  captureBtn:        { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,255,255,0.3)", borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center", marginBottom: 24 },
  captureInner:      { width: 54, height: 54, borderRadius: 27, backgroundColor: "#fff" },
  cancelCamera:      { padding: 12 },
  cancelCameraText:  { color: "#fff", fontSize: 16, fontWeight: "600" },
});