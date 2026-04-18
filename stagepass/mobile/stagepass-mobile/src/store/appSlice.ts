import { createSlice } from '@reduxjs/toolkit';

type AppGateState = {
  onboardingHydrated: boolean;
  onboardingComplete: boolean;
};

const initialState: AppGateState = {
  onboardingHydrated: false,
  onboardingComplete: false,
};

export const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setOnboardingState: (
      state,
      action: { payload: Partial<Pick<AppGateState, 'onboardingHydrated' | 'onboardingComplete'>> }
    ) => {
      if (action.payload.onboardingHydrated !== undefined) {
        state.onboardingHydrated = action.payload.onboardingHydrated;
      }
      if (action.payload.onboardingComplete !== undefined) {
        state.onboardingComplete = action.payload.onboardingComplete;
      }
    },
  },
});

export const { setOnboardingState } = appSlice.actions;
export default appSlice.reducer;
