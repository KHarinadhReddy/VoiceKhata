declare module '@capacitor-community/local-notifications' {
  export interface LocalNotificationSchema {
    title: string;
    body: string;
    id?: string;
    schedule?: {
      at?: Date;
      repeats?: boolean;
      count?: number;
    };
    sound?: string;
    actionTypeId?: string;
    extra?: any;
  }
  export interface ScheduleOptions {
    notifications: LocalNotificationSchema[];
  }
  export interface PermissionStatusResponse {
    display: string;
  }
  export interface LocalNotificationsPlugin {
    requestPermissions(): Promise<PermissionStatusResponse>;
    schedule(options: ScheduleOptions): Promise<void>;
    createChannel?(options: any): Promise<void>;
    removeAllListeners?(): Promise<void>;
  }
  const LocalNotifications: LocalNotificationsPlugin;
  export default LocalNotifications;
  export const LocalNotifications: LocalNotificationsPlugin;
}
