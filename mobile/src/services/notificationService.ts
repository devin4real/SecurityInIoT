import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';

// Cấu hình cách hiển thị thông báo khi app đang ở Foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Hàm xin quyền và lấy cấu hình Push Token của máy.
 * Sẽ trả về 1 chuỗi ký tự (Push Token) nếu thành công.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token = null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    // Nếu chưa có quyền thì xin quyền
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    // Nếu user từ chối
    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return null;
    }

    // Lấy Token
    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;
      
      const pushTokenString = (
        await Notifications.getExpoPushTokenAsync({
          projectId: projectId || undefined,
        })
      ).data;
      token = pushTokenString;
      console.log('📬 Lấy Push Token thành công:', token);
    } catch (e: any) {
      console.error('Lỗi khi lấy push token:', e);
      if (e.message && e.message.includes('Experience with id')) {
        Alert.alert(
          'Thiếu cấu hình Expo Push',
          'Để nhận được thông báo, bạn cần cấu hình Project ID. Vui lòng chạy lệnh: npx eas-cli init'
        );
      }
    }
  } else {
    console.warn('Must use physical device for Push Notifications');
  }

  return token;
}
