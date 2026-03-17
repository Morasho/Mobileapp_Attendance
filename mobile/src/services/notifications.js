import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// How notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
});

/**
 * Request permission and return the Expo push token.
 * Call this once after the student logs in.
 */
export const registerForPushNotifications = async () => {
  if (!Device.isDevice) {
    console.log("Push notifications only work on a physical device");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission denied");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("attendance", {
      name: "Attendance Alerts",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#4361ee",
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  console.log("Push token:", token);
  return token;
};

/**
 * Send a local notification immediately.
 * Used to confirm attendance was marked successfully.
 */
export const sendLocalNotification = async (title, body) => {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null, // null = fire immediately
  });
};

/**
 * Schedule a reminder notification before class starts.
 * @param {string} className  - Name of the class
 * @param {Date}   classTime  - When the class starts
 * @param {number} minutesBefore - How many minutes early to remind (default 15)
 */
export const scheduleClassReminder = async (className, classTime, minutesBefore = 15) => {
  const triggerDate = new Date(classTime.getTime() - minutesBefore * 60 * 1000);

  if (triggerDate <= new Date()) {
    console.log("Reminder time has already passed");
    return;
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Class starting soon 🔔",
      body: `${className} starts in ${minutesBefore} minutes. Don't forget to mark your attendance!`,
      sound: true,
    },
    trigger: { date: triggerDate },
  });

  return id;
};

/**
 * Cancel all scheduled notifications.
 */
export const cancelAllNotifications = async () => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};