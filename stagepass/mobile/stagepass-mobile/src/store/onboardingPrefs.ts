import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'stagepass_onboarding_complete';

export async function getOnboardingComplete(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(ONBOARDING_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

export async function setOnboardingComplete(done: boolean): Promise<void> {
  if (done) {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
  } else {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
  }
}
