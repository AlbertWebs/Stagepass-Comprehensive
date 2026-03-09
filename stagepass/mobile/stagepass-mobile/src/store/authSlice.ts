import { createSlice } from '@reduxjs/toolkit';
import type { User } from '../services/api';

type AuthState = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
};

const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: true,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: { payload: { user: User; token: string } }) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
    },
    setLoading: (state, action: { payload: boolean }) => {
      state.isLoading = action.payload;
    },
    setUser: (state, action: { payload: User }) => {
      state.user = action.payload;
    },
  },
});

export const { setCredentials, logout, setLoading, setUser } = authSlice.actions;
export default authSlice.reducer;
