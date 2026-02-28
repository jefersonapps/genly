import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class NotificationService {
  static async requestPermissions() {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === "granted";
  }

  static async scheduleReminder(taskId: number, title: string, body: string, date: Date) {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return null;

    // Use taskId as part of the identifier to easily manage/cancel it later
    const identifier = `task-reminder-${taskId}`;

    // Cancel any existing reminder for this task first
    await this.cancelReminder(taskId);

    // If date is in the past, don't schedule
    if (date.getTime() <= Date.now()) {
        return null;
    }

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title,
          body,
          data: { taskId },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: date,
        },
      });
      return notificationId;
    } catch (error) {
      console.error("Error scheduling notification:", error);
      return null;
    }
  }

  static async cancelReminder(taskId: number) {
    const identifier = `task-reminder-${taskId}`;
    await Notifications.cancelScheduledNotificationAsync(identifier);
  }
}
