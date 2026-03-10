import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { StyleSheet, View } from 'react-native';

export function HapticTab(props: BottomTabBarButtonProps) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <PlatformPressable
        {...props}
        style={[styles.pressable, props.style, styles.noActiveLine]}
        onPressIn={(ev) => {
          if (process.env.EXPO_OS === 'ios') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          props.onPressIn?.(ev);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  pressable: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noActiveLine: {
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
  },
});
